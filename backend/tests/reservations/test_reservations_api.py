"""PostgreSQL-backed API tests for internal reservation management."""

from datetime import timedelta

import pytest
from django.db import OperationalError
from django.utils import timezone
from rest_framework.test import APIClient

from guests.models import Guest
from identity.models import User, UserRole
from reservations.models import Reservation, ReservationStatus
from reservations.views import ReservationViewSet
from rooms.models import Room, RoomStatus

pytestmark = pytest.mark.django_db

RESERVATIONS_URL = "/api/reservations/"
AVAILABILITY_URL = "/api/reservations/availability/"


@pytest.fixture
def room() -> Room:
    return Room.objects.create(code="101", name="Double room 101", capacity=2)


@pytest.fixture
def second_room() -> Room:
    return Room.objects.create(code="102", name="Double room 102", capacity=2)


@pytest.fixture
def guest() -> Guest:
    return Guest.objects.create(display_name="Ana López")


def authenticated_client(role: str) -> APIClient:
    user = User.objects.create_user(
        username=f"{role}-reservation-user",
        password="not-used-by-force-authentication",
        role=role,
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def future_stay(offset_days: int = 30, nights: int = 2):
    check_in = timezone.localdate() + timedelta(days=offset_days)
    return check_in, check_in + timedelta(days=nights)


def reservation_payload(room: Room, guest: Guest, **overrides: object) -> dict:
    check_in, check_out = future_stay()
    payload = {
        "room": room.pk,
        "guest": guest.pk,
        "check_in": check_in.isoformat(),
        "check_out": check_out.isoformat(),
        "guest_count": 2,
    }
    payload.update(overrides)
    return payload


def create_reservation(
    room: Room, guest: Guest, status: str = ReservationStatus.PENDING, **overrides
) -> Reservation:
    check_in, check_out = future_stay()
    values = {
        "room": room,
        "guest": guest,
        "check_in": check_in,
        "check_out": check_out,
        "guest_count": 2,
        "status": status,
    }
    values.update(overrides)
    return Reservation.objects.create(**values)


@pytest.mark.parametrize("role", [UserRole.ADMINISTRATOR, UserRole.MANAGER])
def test_manager_and_administrator_can_manage_a_reservation(
    role: str, room: Room, guest: Guest
) -> None:
    client = authenticated_client(role)
    creator = User.objects.get(username=f"{role}-reservation-user")
    check_in, check_out = future_stay()

    create_response = client.post(
        RESERVATIONS_URL, reservation_payload(room, guest), format="json"
    )

    assert create_response.status_code == 201
    reservation_id = create_response.data["id"]
    assert create_response.data["room"] == room.pk
    assert create_response.data["guest"] == guest.pk
    assert create_response.data["check_in"] == check_in.isoformat()
    assert create_response.data["check_out"] == check_out.isoformat()
    assert create_response.data["guest_count"] == 2
    assert create_response.data["status"] == ReservationStatus.PENDING
    assert create_response.data["created_by"] == creator.pk

    list_response = client.get(RESERVATIONS_URL)
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.data] == [reservation_id]

    detail_url = f"{RESERVATIONS_URL}{reservation_id}/"
    assert client.get(detail_url).status_code == 200

    update_response = client.patch(
        detail_url, {"internal_notes": "Late arrival requested."}, format="json"
    )
    assert update_response.status_code == 200
    assert update_response.data["internal_notes"] == "Late arrival requested."


def test_manager_can_delete_an_inactive_reservation(room: Room, guest: Guest) -> None:
    client = authenticated_client(UserRole.MANAGER)
    reservation = create_reservation(room, guest, status=ReservationStatus.CANCELLED)

    response = client.delete(f"{RESERVATIONS_URL}{reservation.pk}/")

    assert response.status_code == 204
    assert not Reservation.objects.filter(pk=reservation.pk).exists()


def test_created_by_is_read_only_and_always_the_authenticated_user(
    room: Room, guest: Guest
) -> None:
    client = authenticated_client(UserRole.MANAGER)
    requester = User.objects.get(username="manager-reservation-user")
    another_user = User.objects.create_user(
        username="another-manager",
        password="not-used",
        role=UserRole.MANAGER,
    )

    response = client.post(
        RESERVATIONS_URL,
        reservation_payload(room, guest, created_by=another_user.pk),
        format="json",
    )

    assert response.status_code == 201
    assert response.data["created_by"] == requester.pk


@pytest.mark.parametrize(
    ("method", "url", "data"),
    [
        ("get", RESERVATIONS_URL, None),
        ("post", RESERVATIONS_URL, {}),
        ("get", "/api/reservations/1/", None),
        ("patch", "/api/reservations/1/", {"internal_notes": "Changed"}),
        ("delete", "/api/reservations/1/", None),
        ("get", AVAILABILITY_URL, None),
    ],
)
def test_anonymous_user_cannot_access_reservation_endpoints(
    method: str, url: str, data: dict[str, object] | None
) -> None:
    response = getattr(APIClient(), method)(url, data, format="json")

    assert response.status_code == 401


@pytest.mark.parametrize(
    ("method", "url", "data"),
    [
        ("get", RESERVATIONS_URL, None),
        ("post", RESERVATIONS_URL, {}),
        ("get", "/api/reservations/1/", None),
        ("patch", "/api/reservations/1/", {"internal_notes": "Changed"}),
        ("delete", "/api/reservations/1/", None),
        ("get", AVAILABILITY_URL, None),
    ],
)
def test_employee_is_denied_every_reservation_endpoint(
    method: str, url: str, data: dict[str, object] | None
) -> None:
    client = authenticated_client(UserRole.EMPLOYEE)

    response = getattr(client, method)(url, data, format="json")

    assert response.status_code == 403
    assert response.data == {"detail": "Administrator or manager role required."}


def test_create_rejects_an_inverted_stay(room: Room, guest: Guest) -> None:
    client = authenticated_client(UserRole.MANAGER)
    check_in, _ = future_stay()

    response = client.post(
        RESERVATIONS_URL,
        reservation_payload(
            room,
            guest,
            check_in=check_in.isoformat(),
            check_out=check_in.isoformat(),
        ),
        format="json",
    )

    assert response.status_code == 400
    assert response.data["check_out"][0].code == "check_out_not_after_check_in"


def test_create_requires_valid_dates(room: Room, guest: Guest) -> None:
    client = authenticated_client(UserRole.MANAGER)
    missing_payload = reservation_payload(room, guest)
    missing_payload.pop("check_in")
    missing_payload.pop("check_out")

    missing_response = client.post(RESERVATIONS_URL, missing_payload, format="json")
    invalid_response = client.post(
        RESERVATIONS_URL,
        reservation_payload(room, guest, check_in="not-a-date"),
        format="json",
    )

    assert missing_response.status_code == 400
    assert set(missing_response.data) == {"check_in", "check_out"}
    assert missing_response.data["check_in"][0].code == "required"
    assert missing_response.data["check_out"][0].code == "required"
    assert invalid_response.status_code == 400
    assert invalid_response.data["check_in"][0].code == "invalid"


def test_create_rejects_a_past_check_out(room: Room, guest: Guest) -> None:
    client = authenticated_client(UserRole.MANAGER)
    today = timezone.localdate()

    response = client.post(
        RESERVATIONS_URL,
        reservation_payload(
            room,
            guest,
            check_in=(today - timedelta(days=10)).isoformat(),
            check_out=(today - timedelta(days=5)).isoformat(),
        ),
        format="json",
    )

    assert response.status_code == 400
    assert response.data["check_out"][0].code == "check_out_in_past"


def test_create_rejects_a_guest_count_above_capacity(
    room: Room, guest: Guest
) -> None:
    client = authenticated_client(UserRole.MANAGER)

    response = client.post(
        RESERVATIONS_URL,
        reservation_payload(room, guest, guest_count=3),
        format="json",
    )

    assert response.status_code == 400
    assert response.data["guest_count"][0].code == "guest_count_exceeds_capacity"


def test_create_rejects_an_overlapping_reservation_with_a_stable_error_code(
    room: Room, guest: Guest
) -> None:
    client = authenticated_client(UserRole.MANAGER)
    first_response = client.post(
        RESERVATIONS_URL, reservation_payload(room, guest), format="json"
    )
    assert first_response.status_code == 201

    check_in, check_out = future_stay()
    response = client.post(
        RESERVATIONS_URL,
        reservation_payload(
            room,
            guest,
            check_in=(check_in + timedelta(days=1)).isoformat(),
            check_out=(check_out + timedelta(days=1)).isoformat(),
        ),
        format="json",
    )

    assert response.status_code == 400
    assert response.data["non_field_errors"][0].code == "overlapping_reservation"
    assert Reservation.objects.count() == 1


def test_adjacent_reservations_are_accepted(room: Room, guest: Guest) -> None:
    client = authenticated_client(UserRole.MANAGER)
    check_in, check_out = future_stay()

    first_response = client.post(
        RESERVATIONS_URL,
        reservation_payload(room, guest, check_in=check_in.isoformat(), check_out=check_out.isoformat()),
        format="json",
    )
    second_response = client.post(
        RESERVATIONS_URL,
        reservation_payload(
            room,
            guest,
            check_in=check_out.isoformat(),
            check_out=(check_out + timedelta(days=2)).isoformat(),
        ),
        format="json",
    )

    assert first_response.status_code == 201
    assert second_response.status_code == 201


@pytest.mark.parametrize(
    ("initial_status", "target_status"),
    [
        (ReservationStatus.PENDING, ReservationStatus.CONFIRMED),
        (ReservationStatus.PENDING, ReservationStatus.CANCELLED),
        (ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN),
        (ReservationStatus.CONFIRMED, ReservationStatus.CANCELLED),
        (ReservationStatus.CONFIRMED, ReservationStatus.NO_SHOW),
        (ReservationStatus.CHECKED_IN, ReservationStatus.CHECKED_OUT),
        (ReservationStatus.PENDING, ReservationStatus.PENDING),
    ],
)
def test_allowed_status_transitions_are_accepted(
    room: Room,
    guest: Guest,
    initial_status: str,
    target_status: str,
) -> None:
    client = authenticated_client(UserRole.MANAGER)
    reservation = create_reservation(room, guest, status=initial_status)

    response = client.patch(
        f"{RESERVATIONS_URL}{reservation.pk}/",
        {"status": target_status},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["status"] == target_status


@pytest.mark.parametrize(
    ("initial_status", "target_status"),
    [
        (ReservationStatus.PENDING, ReservationStatus.CHECKED_IN),
        (ReservationStatus.PENDING, ReservationStatus.CHECKED_OUT),
        (ReservationStatus.PENDING, ReservationStatus.NO_SHOW),
        (ReservationStatus.CONFIRMED, ReservationStatus.PENDING),
        (ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_OUT),
        (ReservationStatus.CHECKED_IN, ReservationStatus.CONFIRMED),
        (ReservationStatus.CHECKED_IN, ReservationStatus.CANCELLED),
        (ReservationStatus.CHECKED_OUT, ReservationStatus.CANCELLED),
        (ReservationStatus.CANCELLED, ReservationStatus.PENDING),
        (ReservationStatus.NO_SHOW, ReservationStatus.CONFIRMED),
    ],
)
def test_invalid_status_transitions_are_rejected_with_a_stable_error_code(
    room: Room,
    guest: Guest,
    initial_status: str,
    target_status: str,
) -> None:
    client = authenticated_client(UserRole.MANAGER)
    reservation = create_reservation(room, guest, status=initial_status)

    response = client.patch(
        f"{RESERVATIONS_URL}{reservation.pk}/",
        {"status": target_status},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["status"][0].code == "invalid_status_transition"
    reservation.refresh_from_db()
    assert reservation.status == initial_status


def test_create_rejects_an_unknown_status(room: Room, guest: Guest) -> None:
    client = authenticated_client(UserRole.MANAGER)

    response = client.post(
        RESERVATIONS_URL,
        reservation_payload(room, guest, status="unknown"),
        format="json",
    )

    assert response.status_code == 400
    assert response.data["status"][0].code == "invalid_choice"


def test_updating_a_reservation_does_not_conflict_with_itself(
    room: Room, guest: Guest
) -> None:
    client = authenticated_client(UserRole.MANAGER)
    reservation = create_reservation(room, guest)
    _, check_out = future_stay()

    response = client.patch(
        f"{RESERVATIONS_URL}{reservation.pk}/",
        {
            "check_out": (check_out + timedelta(days=2)).isoformat(),
            "internal_notes": "Extended stay.",
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.data["internal_notes"] == "Extended stay."
    reservation.refresh_from_db()
    assert reservation.check_out == check_out + timedelta(days=2)


def test_updating_an_existing_reservation_does_not_reapply_the_past_rule(
    room: Room, guest: Guest
) -> None:
    client = authenticated_client(UserRole.MANAGER)
    today = timezone.localdate()
    reservation = create_reservation(
        room,
        guest,
        status=ReservationStatus.CHECKED_IN,
        check_in=today - timedelta(days=5),
        check_out=today - timedelta(days=3),
    )

    response = client.patch(
        f"{RESERVATIONS_URL}{reservation.pk}/",
        {"status": ReservationStatus.CHECKED_OUT},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["status"] == ReservationStatus.CHECKED_OUT


def test_updating_into_another_reservations_range_is_rejected(
    room: Room, guest: Guest
) -> None:
    client = authenticated_client(UserRole.MANAGER)
    check_in, check_out = future_stay()
    create_reservation(
        room,
        guest,
        check_in=check_in,
        check_out=check_out,
    )
    later_check_in = check_out + timedelta(days=2)
    later_reservation = create_reservation(
        room,
        guest,
        check_in=later_check_in,
        check_out=later_check_in + timedelta(days=2),
    )

    response = client.patch(
        f"{RESERVATIONS_URL}{later_reservation.pk}/",
        {
            "check_in": (check_in + timedelta(days=1)).isoformat(),
            "check_out": (check_in + timedelta(days=3)).isoformat(),
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.data["non_field_errors"][0].code == "overlapping_reservation"


def test_reassigning_a_reservation_into_an_occupied_room_is_rejected(
    room: Room, second_room: Room, guest: Guest
) -> None:
    client = authenticated_client(UserRole.MANAGER)
    check_in, check_out = future_stay()
    reservation = create_reservation(
        room,
        guest,
        check_in=check_in,
        check_out=check_out,
    )
    create_reservation(
        second_room,
        guest,
        check_in=check_in,
        check_out=check_out,
    )

    response = client.patch(
        f"{RESERVATIONS_URL}{reservation.pk}/",
        {"room": second_room.pk},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["non_field_errors"][0].code == "overlapping_reservation"
    reservation.refresh_from_db()
    assert reservation.room == room


@pytest.mark.parametrize(
    "status",
    [
        ReservationStatus.PENDING,
        ReservationStatus.CONFIRMED,
        ReservationStatus.CHECKED_IN,
    ],
)
def test_occupying_reservations_cannot_be_deleted(
    room: Room, guest: Guest, status: str
) -> None:
    client = authenticated_client(UserRole.MANAGER)
    reservation = create_reservation(room, guest, status=status)

    response = client.delete(f"{RESERVATIONS_URL}{reservation.pk}/")

    assert response.status_code == 400
    assert response.data["detail"].code == "reservation_is_occupying"
    assert Reservation.objects.filter(pk=reservation.pk).exists()


@pytest.mark.parametrize(
    "status",
    [
        ReservationStatus.CHECKED_OUT,
        ReservationStatus.CANCELLED,
        ReservationStatus.NO_SHOW,
    ],
)
def test_non_occupying_reservations_can_be_deleted(
    room: Room, guest: Guest, status: str
) -> None:
    client = authenticated_client(UserRole.MANAGER)
    reservation = create_reservation(room, guest, status=status)

    response = client.delete(f"{RESERVATIONS_URL}{reservation.pk}/")

    assert response.status_code == 204
    assert not Reservation.objects.filter(pk=reservation.pk).exists()


def test_availability_excludes_non_operational_and_occupied_rooms(
    room: Room, second_room: Room, guest: Guest
) -> None:
    Room.objects.create(
        code="103", name="Maintenance room", capacity=2, status=RoomStatus.MAINTENANCE
    )
    Room.objects.create(
        code="104",
        name="Out of service room",
        capacity=2,
        status=RoomStatus.OUT_OF_SERVICE,
    )
    check_in, check_out = future_stay()
    create_reservation(room, guest, check_in=check_in, check_out=check_out)
    client = authenticated_client(UserRole.MANAGER)

    response = client.get(
        AVAILABILITY_URL,
        {"check_in": check_in.isoformat(), "check_out": check_out.isoformat()},
    )

    assert response.status_code == 200
    assert response.data["check_in"] == check_in.isoformat()
    assert response.data["check_out"] == check_out.isoformat()
    assert [room_data["code"] for room_data in response.data["rooms"]] == [
        second_room.code
    ]

    adjacent_response = client.get(
        AVAILABILITY_URL,
        {
            "check_in": check_out.isoformat(),
            "check_out": (check_out + timedelta(days=2)).isoformat(),
        },
    )
    assert adjacent_response.status_code == 200
    assert [room_data["code"] for room_data in adjacent_response.data["rooms"]] == [
        "101",
        "102",
    ]


@pytest.mark.parametrize(
    "status",
    [
        ReservationStatus.CANCELLED,
        ReservationStatus.CHECKED_OUT,
        ReservationStatus.NO_SHOW,
    ],
)
def test_non_occupying_reservations_do_not_block_availability(
    room: Room, guest: Guest, status: str
) -> None:
    check_in, check_out = future_stay()
    create_reservation(room, guest, status=status, check_in=check_in, check_out=check_out)
    client = authenticated_client(UserRole.MANAGER)

    response = client.get(
        AVAILABILITY_URL,
        {"check_in": check_in.isoformat(), "check_out": check_out.isoformat()},
    )

    assert response.status_code == 200
    assert [room_data["code"] for room_data in response.data["rooms"]] == [room.code]


def test_availability_accepts_an_optional_room_filter(
    room: Room, second_room: Room, guest: Guest
) -> None:
    check_in, check_out = future_stay()
    create_reservation(room, guest, check_in=check_in, check_out=check_out)
    client = authenticated_client(UserRole.MANAGER)

    available_response = client.get(
        AVAILABILITY_URL,
        {
            "check_in": check_in.isoformat(),
            "check_out": check_out.isoformat(),
            "room": second_room.pk,
        },
    )
    occupied_response = client.get(
        AVAILABILITY_URL,
        {
            "check_in": check_in.isoformat(),
            "check_out": check_out.isoformat(),
            "room": room.pk,
        },
    )

    assert available_response.status_code == 200
    assert [room_data["code"] for room_data in available_response.data["rooms"]] == [
        second_room.code
    ]
    assert occupied_response.status_code == 200
    assert occupied_response.data["rooms"] == []


def test_availability_rejects_an_inverted_or_missing_range() -> None:
    client = authenticated_client(UserRole.MANAGER)
    check_in, _ = future_stay()

    inverted_response = client.get(
        AVAILABILITY_URL,
        {"check_in": check_in.isoformat(), "check_out": check_in.isoformat()},
    )
    missing_response = client.get(AVAILABILITY_URL)
    invalid_response = client.get(
        AVAILABILITY_URL, {"check_in": "not-a-date", "check_out": "2026-12-01"}
    )

    assert inverted_response.status_code == 400
    assert (
        inverted_response.data["check_out"][0].code
        == "check_out_not_after_check_in"
    )
    assert missing_response.status_code == 400
    assert set(missing_response.data) == {"check_in", "check_out"}
    assert invalid_response.status_code == 400
    assert invalid_response.data["check_in"][0].code == "invalid"


def test_database_overlap_violation_is_translated_to_a_stable_400_payload(
    room: Room, guest: Guest, monkeypatch
) -> None:
    client = authenticated_client(UserRole.MANAGER)
    first_response = client.post(
        RESERVATIONS_URL, reservation_payload(room, guest), format="json"
    )
    assert first_response.status_code == 201

    # Bypass the service-level pre-check so PostgreSQL's exclusion constraint is
    # the code path that raises IntegrityError.
    monkeypatch.setattr(
        "reservations.views.ensure_room_is_available",
        lambda **kwargs: None,
    )
    check_in, check_out = future_stay()
    response = client.post(
        RESERVATIONS_URL,
        reservation_payload(
            room,
            guest,
            check_in=(check_in + timedelta(days=1)).isoformat(),
            check_out=(check_out + timedelta(days=1)).isoformat(),
        ),
        format="json",
    )

    assert response.status_code == 400
    assert response.data == {
        "non_field_errors": [
            "This room already has an overlapping reservation."
        ]
    }
    assert response.data["non_field_errors"][0].code == "overlapping_reservation"
    assert Reservation.objects.count() == 1


class _SimulatedPostgresError(Exception):
    """Carry a SQLSTATE on a cause without creating a real database error."""

    def __init__(self, sqlstate: str) -> None:
        super().__init__(sqlstate)
        self.sqlstate = sqlstate


@pytest.mark.parametrize("sqlstate", ["40P01", "55P03"])
def test_lock_conflicts_map_to_a_retryable_reservation_conflict(
    monkeypatch, room: Room, guest: Guest, sqlstate: str
) -> None:
    client = authenticated_client(UserRole.MANAGER)
    reservation = create_reservation(room, guest)

    def failing_lock_room(*args, **kwargs):
        raise OperationalError("simulated database lock failure") from (
            _SimulatedPostgresError(sqlstate)
        )

    monkeypatch.setattr(
        ReservationViewSet,
        "_lock_room",
        staticmethod(failing_lock_room),
    )

    response = client.patch(
        f"{RESERVATIONS_URL}{reservation.pk}/",
        {"internal_notes": "Late arrival requested."},
        format="json",
    )

    assert response.status_code == 409
    assert response.data["detail"].code == "reservation_conflict"
    rendered_body = response.content.decode()
    assert sqlstate not in rendered_body
    assert "simulated database lock failure" not in rendered_body

    reservation.refresh_from_db()
    assert reservation.internal_notes == ""
