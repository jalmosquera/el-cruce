"""PostgreSQL-backed model and API tests for internal room management."""

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from rest_framework.test import APIClient

from identity.models import User, UserRole
from rooms.models import Room, RoomStatus

pytestmark = pytest.mark.django_db

ROOMS_URL = "/api/rooms/"


@pytest.fixture
def room() -> Room:
    return Room.objects.create(code="101", name="Double room 101", capacity=2)


def authenticated_client(role: str) -> APIClient:
    user = User.objects.create_user(
        username=f"{role}-room-user",
        password="not-used-by-force-authentication",
        role=role,
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def room_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "code": "101",
        "name": "Double room 101",
        "capacity": 2,
        "status": RoomStatus.OPERATIONAL,
    }
    payload.update(overrides)
    return payload


def test_room_model_orders_by_code_and_exposes_operational_status_choices() -> None:
    Room.objects.create(code="202", name="Double room 202", capacity=2)
    Room.objects.create(
        code="101",
        name="Single room 101",
        capacity=1,
        status=RoomStatus.MAINTENANCE,
    )

    assert list(Room.objects.values_list("code", flat=True)) == ["101", "202"]
    assert RoomStatus.values == ["operational", "maintenance", "out_of_service"]


def test_room_model_rejects_non_positive_capacity_in_validation_and_database() -> None:
    invalid_room = Room(code="101", name="Invalid room", capacity=0)

    with pytest.raises(ValidationError) as validation_error:
        invalid_room.full_clean()
    assert validation_error.value.error_dict["capacity"][0].code == "min_value"

    room = Room.objects.create(code="102", name="Single room 102", capacity=1)
    with pytest.raises(IntegrityError), transaction.atomic():
        Room.objects.filter(pk=room.pk).update(capacity=0)


def test_room_model_rejects_duplicate_stable_codes() -> None:
    Room.objects.create(code="101", name="Single room 101", capacity=1)

    with pytest.raises(IntegrityError), transaction.atomic():
        Room.objects.create(code="101", name="Duplicate room 101", capacity=2)


@pytest.mark.parametrize("role", [UserRole.ADMINISTRATOR, UserRole.MANAGER])
def test_administrator_and_manager_can_list_rooms(role: str, room: Room) -> None:
    response = authenticated_client(role).get(ROOMS_URL)

    assert response.status_code == 200
    assert response.data == [
        {
            "id": room.pk,
            "code": "101",
            "name": "Double room 101",
            "capacity": 2,
            "status": "operational",
        }
    ]


def test_anonymous_user_cannot_access_rooms() -> None:
    response = APIClient().get(ROOMS_URL)

    assert response.status_code == 401


@pytest.mark.parametrize(
    ("method", "url", "data"),
    [
        ("get", ROOMS_URL, None),
        ("post", ROOMS_URL, room_payload()),
        ("get", "/api/rooms/1/", None),
        ("patch", "/api/rooms/1/", {"name": "Changed room"}),
        ("delete", "/api/rooms/1/", None),
    ],
)
def test_employee_is_denied_every_room_endpoint(
    method: str, url: str, data: dict[str, object] | None
) -> None:
    client = authenticated_client(UserRole.EMPLOYEE)

    response = getattr(client, method)(url, data, format="json")

    assert response.status_code == 403
    assert response.data == {"detail": "Administrator or manager role required."}


def test_manager_can_create_update_and_delete_a_room() -> None:
    client = authenticated_client(UserRole.MANAGER)

    create_response = client.post(ROOMS_URL, room_payload(), format="json")

    assert create_response.status_code == 201
    room_id = create_response.data["id"]
    assert create_response.data == {
        "id": room_id,
        "code": "101",
        "name": "Double room 101",
        "capacity": 2,
        "status": "operational",
    }

    detail_url = f"{ROOMS_URL}{room_id}/"
    update_response = client.patch(
        detail_url,
        {"name": "Renovated double room", "capacity": 3, "status": "maintenance"},
        format="json",
    )
    assert update_response.status_code == 200
    assert update_response.data == {
        "id": room_id,
        "code": "101",
        "name": "Renovated double room",
        "capacity": 3,
        "status": "maintenance",
    }

    delete_response = client.delete(detail_url)
    assert delete_response.status_code == 204
    assert not Room.objects.filter(pk=room_id).exists()


@pytest.mark.parametrize(
    ("payload", "expected_errors", "expected_error_code"),
    [
        ({"capacity": 0}, {"capacity": ["Capacity must be greater than zero."]}, "min_value"),
        ({"status": "unavailable"}, {"status": None}, "invalid_choice"),
        ({"name": ""}, {"name": None}, "blank"),
    ],
)
def test_create_room_returns_explicit_field_validation_errors(
    payload: dict[str, object],
    expected_errors: dict[str, list[str] | None],
    expected_error_code: str,
) -> None:
    response = authenticated_client(UserRole.ADMINISTRATOR).post(
        ROOMS_URL,
        room_payload(**payload),
        format="json",
    )

    assert response.status_code == 400
    assert set(response.data) == set(expected_errors)
    for field_name, expected_error_messages in expected_errors.items():
        assert response.data[field_name][0].code == expected_error_code
        if expected_error_messages is not None:
            assert list(response.data[field_name]) == expected_error_messages


def test_room_code_cannot_change_after_creation(room: Room) -> None:
    response = authenticated_client(UserRole.ADMINISTRATOR).patch(
        f"{ROOMS_URL}{room.pk}/",
        {"code": "102"},
        format="json",
    )

    assert response.status_code == 400
    assert response.data == {"code": ["Room code cannot be changed after creation."]}
    room.refresh_from_db()
    assert room.code == "101"


def test_create_room_returns_a_field_error_for_a_duplicate_code(room: Room) -> None:
    response = authenticated_client(UserRole.ADMINISTRATOR).post(
        ROOMS_URL,
        room_payload(),
        format="json",
    )

    assert response.status_code == 400
    assert response.data == {"code": ["A room with this code already exists."]}
