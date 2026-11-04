"""Domain services for room reservation availability."""

from django.db.models import Max

from .models import OCCUPYING_RESERVATION_STATUSES, Reservation


class OverlappingReservationError(Exception):
    """The requested room stay conflicts with an occupying reservation."""


class GuestCountExceedsCapacityError(Exception):
    """The requested guest count does not fit the selected room."""


def ensure_guest_count_fits(*, room, guest_count: int) -> None:
    """Reject a reservation that exceeds the physical room capacity."""
    if guest_count > room.capacity:
        raise GuestCountExceedsCapacityError


def get_largest_occupying_guest_count(room) -> int | None:
    """Return the largest guest count among the room's occupying reservations."""
    return Reservation.objects.filter(
        room=room,
        status__in=OCCUPYING_RESERVATION_STATUSES,
    ).aggregate(largest=Max("guest_count"))["largest"]


def ensure_room_is_available(
    *,
    room,
    check_in,
    check_out,
    status: str,
    exclude_pk: int | None = None,
) -> None:
    """Reject an occupying stay that overlaps another occupying reservation."""
    if status not in OCCUPYING_RESERVATION_STATUSES:
        return

    overlapping_reservations = Reservation.objects.filter(
        room=room,
        status__in=OCCUPYING_RESERVATION_STATUSES,
        check_in__lt=check_out,
        check_out__gt=check_in,
    )
    if exclude_pk is not None:
        overlapping_reservations = overlapping_reservations.exclude(pk=exclude_pk)

    if overlapping_reservations.exists():
        raise OverlappingReservationError
