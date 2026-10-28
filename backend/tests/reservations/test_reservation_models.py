"""PostgreSQL-backed model tests for internal reservations."""

from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError
from django.utils import timezone

from guests.models import Guest
from identity.models import User, UserRole
from reservations.models import (
    ALLOWED_STATUS_TRANSITIONS,
    OCCUPYING_RESERVATION_STATUSES,
    Reservation,
    ReservationStatus,
)
from rooms.models import Room

pytestmark = pytest.mark.django_db


@pytest.fixture
def room() -> Room:
    return Room.objects.create(code="101", name="Double room 101", capacity=2)


@pytest.fixture
def guest() -> Guest:
    return Guest.objects.create(display_name="Ana López")


def future_stay(offset_days: int = 30, nights: int = 2):
    check_in = timezone.localdate() + timedelta(days=offset_days)
    return check_in, check_in + timedelta(days=nights)


def reservation_payload(room: Room, guest: Guest, **overrides: object) -> dict:
    check_in, check_out = future_stay()
    values = {
        "room": room,
        "guest": guest,
        "check_in": check_in,
        "check_out": check_out,
        "guest_count": 2,
    }
    values.update(overrides)
    return values


def test_status_choices_and_occupying_statuses_are_explicit() -> None:
    assert ReservationStatus.values == [
        "pending",
        "confirmed",
        "checked_in",
        "checked_out",
        "cancelled",
        "no_show",
    ]
    assert OCCUPYING_RESERVATION_STATUSES == (
        ReservationStatus.PENDING,
        ReservationStatus.CONFIRMED,
        ReservationStatus.CHECKED_IN,
    )


def test_status_transition_map_is_explicit() -> None:
    assert ALLOWED_STATUS_TRANSITIONS == {
        ReservationStatus.PENDING: frozenset(
            {ReservationStatus.CONFIRMED, ReservationStatus.CANCELLED}
        ),
        ReservationStatus.CONFIRMED: frozenset(
            {
                ReservationStatus.CHECKED_IN,
                ReservationStatus.CANCELLED,
                ReservationStatus.NO_SHOW,
            }
        ),
        ReservationStatus.CHECKED_IN: frozenset({ReservationStatus.CHECKED_OUT}),
        ReservationStatus.CHECKED_OUT: frozenset(),
        ReservationStatus.CANCELLED: frozenset(),
        ReservationStatus.NO_SHOW: frozenset(),
    }


def test_model_validation_accepts_a_valid_reservation(room: Room, guest: Guest) -> None:
    reservation = Reservation(**reservation_payload(room, guest))

    reservation.full_clean()

    assert reservation.status == ReservationStatus.PENDING
    assert reservation.internal_notes == ""
    assert reservation.created_by is None


@pytest.mark.parametrize(
    ("check_in_offset", "check_out_offset"),
    [(30, 30), (30, 29)],
)
def test_model_validation_rejects_a_non_increasing_interval(
    room: Room, guest: Guest, check_in_offset: int, check_out_offset: int
) -> None:
    check_in = timezone.localdate() + timedelta(days=check_in_offset)
    check_out = timezone.localdate() + timedelta(days=check_out_offset)
    reservation = Reservation(
        **reservation_payload(room, guest, check_in=check_in, check_out=check_out)
    )

    with pytest.raises(ValidationError) as error:
        reservation.full_clean()

    assert error.value.message_dict["check_out"] == [
        "Check-out must be later than check-in."
    ]


def test_model_validation_rejects_a_past_check_out_for_a_new_reservation(
    room: Room, guest: Guest
) -> None:
    today = timezone.localdate()
    reservation = Reservation(
        **reservation_payload(
            room,
            guest,
            check_in=today - timedelta(days=10),
            check_out=today - timedelta(days=5),
        )
    )

    with pytest.raises(ValidationError) as error:
        reservation.full_clean()

    assert error.value.message_dict["check_out"] == [
        "Check-out date cannot be in the past."
    ]


def test_model_validation_rejects_a_guest_count_above_capacity(
    room: Room, guest: Guest
) -> None:
    reservation = Reservation(**reservation_payload(room, guest, guest_count=3))

    with pytest.raises(ValidationError) as error:
        reservation.full_clean()

    assert error.value.message_dict["guest_count"] == [
        "Guest count exceeds room capacity."
    ]


def test_database_rejects_a_non_increasing_interval(room: Room, guest: Guest) -> None:
    reservation = Reservation.objects.create(**reservation_payload(room, guest))

    with pytest.raises(IntegrityError), transaction.atomic():
        Reservation.objects.filter(pk=reservation.pk).update(
            check_out=reservation.check_in
        )


def test_database_rejects_a_non_positive_guest_count(room: Room, guest: Guest) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        Reservation.objects.create(**reservation_payload(room, guest, guest_count=0))


def test_database_rejects_an_unknown_status(room: Room, guest: Guest) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        Reservation.objects.create(
            **reservation_payload(room, guest, status="unknown")
        )


def test_adjacent_ranges_are_allowed_and_checkout_may_equal_next_check_in(
    room: Room, guest: Guest
) -> None:
    check_in, check_out = future_stay()
    next_check_in = check_out
    next_check_out = check_out + timedelta(days=2)

    first = Reservation.objects.create(
        **reservation_payload(room, guest, check_in=check_in, check_out=check_out)
    )
    second = Reservation.objects.create(
        **reservation_payload(
            room,
            guest,
            check_in=next_check_in,
            check_out=next_check_out,
        )
    )

    assert first.pk != second.pk
    assert Reservation.objects.filter(room=room).count() == 2


@pytest.mark.parametrize(
    "status",
    [
        ReservationStatus.PENDING,
        ReservationStatus.CONFIRMED,
        ReservationStatus.CHECKED_IN,
    ],
)
def test_every_occupying_status_blocks_an_overlapping_reservation(
    room: Room, guest: Guest, status: str
) -> None:
    check_in, check_out = future_stay()
    Reservation.objects.create(
        **reservation_payload(room, guest, status=status)
    )

    with pytest.raises(IntegrityError), transaction.atomic():
        Reservation.objects.create(
            **reservation_payload(
                room,
                guest,
                check_in=check_in + timedelta(days=1),
                check_out=check_out + timedelta(days=1),
            )
        )


@pytest.mark.parametrize(
    "status",
    [
        ReservationStatus.CANCELLED,
        ReservationStatus.CHECKED_OUT,
        ReservationStatus.NO_SHOW,
    ],
)
def test_inactive_statuses_do_not_block_an_overlapping_reservation(
    room: Room, guest: Guest, status: str
) -> None:
    check_in, check_out = future_stay()
    Reservation.objects.create(
        **reservation_payload(room, guest, status=status)
    )

    Reservation.objects.create(
        **reservation_payload(
            room,
            guest,
            check_in=check_in + timedelta(days=1),
            check_out=check_out + timedelta(days=1),
            status=ReservationStatus.PENDING,
        )
    )

    assert Reservation.objects.filter(room=room).count() == 2


def test_created_by_is_nullable_and_becomes_null_when_the_user_is_deleted(
    room: Room, guest: Guest
) -> None:
    creator = User.objects.create_user(
        username="reservation-creator",
        password="not-used",
        role=UserRole.MANAGER,
    )
    reservation = Reservation.objects.create(
        **reservation_payload(room, guest, created_by=creator)
    )

    creator.delete()
    reservation.refresh_from_db()

    assert reservation.created_by is None


def test_room_and_guest_are_protected_while_a_reservation_exists(
    room: Room, guest: Guest
) -> None:
    Reservation.objects.create(**reservation_payload(room, guest))

    with pytest.raises(ProtectedError), transaction.atomic():
        room.delete()
    with pytest.raises(ProtectedError), transaction.atomic():
        guest.delete()
