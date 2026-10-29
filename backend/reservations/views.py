"""DRF endpoints for internal reservation management."""

from django.db import DatabaseError, IntegrityError, transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ErrorDetail, ValidationError
from rest_framework.response import Response

from rooms.models import Room, RoomStatus
from rooms.serializers import RoomSerializer

from .models import (
    ALLOWED_STATUS_TRANSITIONS,
    OCCUPYING_RESERVATION_STATUSES,
    Reservation,
    ReservationStatus,
)
from .permissions import IsReservationAdministratorOrManager
from .serializers import AvailabilityQuerySerializer, ReservationSerializer
from .services import (
    GuestCountExceedsCapacityError,
    OverlappingReservationError,
    ensure_guest_count_fits,
    ensure_room_is_available,
)

# PostgreSQL lock conflicts that mean "retry the request" rather than a bug:
# 40P01 deadlock_detected and 55P03 lock_not_available.
RESERVATION_CONFLICT_SQLSTATES = frozenset({"40P01", "55P03"})


class ReservationViewSet(viewsets.ModelViewSet):
    """Manage internal reservations with database-backed overlap prevention."""

    queryset = (
        Reservation.objects.select_related("room", "guest", "created_by")
        .order_by("check_in", "pk")
    )
    serializer_class = ReservationSerializer
    permission_classes = [IsReservationAdministratorOrManager]

    def create(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                return super().create(request, *args, **kwargs)
        except IntegrityError as error:
            return self._handle_integrity_error(error)
        except DatabaseError as error:
            if self._is_lock_conflict(error):
                return self._conflict_response()
            raise
        except OverlappingReservationError:
            return self._overlap_response()
        except GuestCountExceedsCapacityError:
            return self._capacity_response()

    def update(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                return super().update(request, *args, **kwargs)
        except IntegrityError as error:
            return self._handle_integrity_error(error)
        except DatabaseError as error:
            if self._is_lock_conflict(error):
                return self._conflict_response()
            raise
        except OverlappingReservationError:
            return self._overlap_response()
        except GuestCountExceedsCapacityError:
            return self._capacity_response()

    def perform_create(self, serializer: ReservationSerializer) -> None:
        attributes = serializer.validated_data
        locked_room = self._lock_room(attributes["room"])
        status_value = attributes.get("status", ReservationStatus.PENDING)

        ensure_guest_count_fits(
            room=locked_room,
            guest_count=attributes["guest_count"],
        )
        ensure_room_is_available(
            room=locked_room,
            check_in=attributes["check_in"],
            check_out=attributes["check_out"],
            status=status_value,
        )

        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer: ReservationSerializer) -> None:
        """Apply updates against a locked, freshly re-read reservation row.

        Validation performed by the serializer used the instance fetched before
        this request acquired any lock, so it cannot be trusted to serialize
        concurrent updates. The room rows are locked first (the same order used
        by create), then the reservation row is locked and re-read. Only the
        fields actually supplied by the request are written, so an unrelated
        concurrent edit cannot be overwritten with stale values.

        The effective room is resolved again after the reservation lock: when the
        request does not reassign the room, a concurrent update may already have
        moved the reservation, so the stale pre-lock room must not be used for
        capacity or overlap validation.
        """
        original = serializer.instance
        attributes = serializer.validated_data
        requested_room = attributes.get("room")

        # Lock every room known before the reservation lock. When the request
        # reassigns the room, both the room read with the reservation and the
        # requested room may be involved; acquire them in ascending primary-key
        # order so concurrent room swaps cannot deadlock.
        rooms_to_lock = {original.room}
        if requested_room is not None:
            rooms_to_lock.add(requested_room)
        locked_rooms = self._lock_rooms(rooms_to_lock)

        reservation = Reservation.objects.select_for_update().get(pk=original.pk)
        effective_room = (
            requested_room if requested_room is not None else reservation.room
        )
        locked_room = locked_rooms.get(effective_room.pk)
        if locked_room is None:
            # Another request moved the reservation to a room that was not
            # known before this request acquired its locks. Lock the room now in
            # use so validation runs against the state that will be committed.
            # This lock is deliberately non-blocking: waiting for a room while
            # holding the reservation lock inverts the lock order used by room
            # moves and can deadlock. A lock conflict is reported as 409 so the
            # client can retry against the new state.
            locked_room = self._lock_room(effective_room, nowait=True)

        self._validate_locked_update(
            reservation=reservation,
            original_status=original.status,
            room=locked_room,
            attributes=attributes,
        )

        status_value = attributes.get("status", reservation.status)
        ensure_guest_count_fits(
            room=locked_room,
            guest_count=attributes.get("guest_count", reservation.guest_count),
        )
        ensure_room_is_available(
            room=locked_room,
            check_in=attributes.get("check_in", reservation.check_in),
            check_out=attributes.get("check_out", reservation.check_out),
            status=status_value,
            exclude_pk=reservation.pk,
        )

        for field_name, value in attributes.items():
            setattr(reservation, field_name, value)
        update_fields = {*attributes, "updated_at"}
        reservation.save(update_fields=update_fields)
        serializer.instance = reservation

    @staticmethod
    def _validate_locked_update(
        *,
        reservation: Reservation,
        original_status: str,
        room: Room,
        attributes: dict[str, object],
    ) -> None:
        """Revalidate invariants that could have changed while waiting for the lock."""
        check_in = attributes.get("check_in", reservation.check_in)
        check_out = attributes.get("check_out", reservation.check_out)
        guest_count = attributes.get("guest_count", reservation.guest_count)
        requested_status = attributes.get("status", reservation.status)

        errors = {}
        if check_out <= check_in:
            errors["check_out"] = [
                ErrorDetail(
                    "Check-out must be later than check-in.",
                    code="check_out_not_after_check_in",
                )
            ]
        if guest_count > room.capacity:
            errors["guest_count"] = [
                ErrorDetail(
                    "Guest count exceeds room capacity.",
                    code="guest_count_exceeds_capacity",
                )
            ]
        if "status" in attributes and requested_status != reservation.status:
            if reservation.status != original_status:
                # Another request transitioned this reservation while this one
                # was waiting for the lock. Reject the stale transition so only
                # one of the competing requests can change the status.
                errors["status"] = [
                    ErrorDetail(
                        "Reservation status changed concurrently; retry the request.",
                        code="invalid_status_transition",
                    )
                ]
            elif requested_status not in ALLOWED_STATUS_TRANSITIONS.get(
                reservation.status, frozenset()
            ):
                errors["status"] = [
                    ErrorDetail(
                        "Invalid status transition.",
                        code="invalid_status_transition",
                    )
                ]

        if errors:
            raise ValidationError(errors)

    def destroy(self, request, *args, **kwargs):
        reservation = self.get_object()
        if reservation.status in OCCUPYING_RESERVATION_STATUSES:
            return Response(
                {
                    "detail": ErrorDetail(
                        "Occupying reservations cannot be deleted.",
                        code="reservation_is_occupying",
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def availability(self, request) -> Response:
        """List operational rooms with no occupying overlap for the requested stay."""
        query_serializer = AvailabilityQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)
        stay = query_serializer.validated_data

        rooms = Room.objects.filter(status=RoomStatus.OPERATIONAL)
        if "room" in stay:
            rooms = rooms.filter(pk=stay["room"])

        occupied_room_ids = Reservation.objects.filter(
            status__in=OCCUPYING_RESERVATION_STATUSES,
            check_in__lt=stay["check_out"],
            check_out__gt=stay["check_in"],
        ).values("room_id")
        rooms = rooms.exclude(pk__in=occupied_room_ids).order_by("code")

        return Response(
            {
                "check_in": stay["check_in"].isoformat(),
                "check_out": stay["check_out"].isoformat(),
                "rooms": RoomSerializer(rooms, many=True).data,
            }
        )

    @classmethod
    def _lock_rooms(cls, rooms) -> dict[int, Room]:
        """Lock rooms in ascending primary-key order to keep lock ordering stable."""
        rooms_by_pk = {room.pk: room for room in rooms if room is not None}
        return {
            pk: cls._lock_room(rooms_by_pk[pk])
            for pk in sorted(rooms_by_pk)
        }

    @staticmethod
    def _lock_room(room: Room, *, nowait: bool = False) -> Room:
        """Serialize competing writes for the same room before checking overlap.

        ``nowait`` is only used for rooms discovered after the reservation row
        is locked, where blocking could deadlock with a concurrent room move.
        """
        return Room.objects.select_for_update(nowait=nowait).get(pk=room.pk)

    @staticmethod
    def _overlap_response() -> Response:
        return Response(
            {
                "non_field_errors": [
                    ErrorDetail(
                        "This room already has an overlapping reservation.",
                        code="overlapping_reservation",
                    )
                ]
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    @staticmethod
    def _capacity_response() -> Response:
        return Response(
            {
                "guest_count": [
                    ErrorDetail(
                        "Guest count exceeds room capacity.",
                        code="guest_count_exceeds_capacity",
                    )
                ]
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    @staticmethod
    def _conflict_response() -> Response:
        """Return a retryable conflict without exposing database details."""
        return Response(
            {
                "detail": ErrorDetail(
                    "The reservation was modified concurrently. Retry the request.",
                    code="reservation_conflict",
                )
            },
            status=status.HTTP_409_CONFLICT,
        )

    @staticmethod
    def _is_lock_conflict(error: BaseException) -> bool:
        """Detect PostgreSQL deadlock or non-blocking lock acquisition failures."""
        current: BaseException | None = error
        while current is not None:
            sqlstate = getattr(current, "sqlstate", None) or getattr(
                current, "pgcode", None
            )
            if sqlstate in RESERVATION_CONFLICT_SQLSTATES:
                return True
            current = current.__cause__
        return False

    @staticmethod
    def _handle_integrity_error(error: IntegrityError) -> Response:
        diagnostic = getattr(getattr(error, "__cause__", None), "diag", None)
        if (
            getattr(diagnostic, "constraint_name", None)
            == "reservations_reservation_no_room_overlap"
        ):
            return ReservationViewSet._overlap_response()
        raise error
