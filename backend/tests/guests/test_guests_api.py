"""PostgreSQL-backed API tests for internal guest management."""

import pytest
from rest_framework.test import APIClient

from guests.models import Guest
from guests.normalization import DISPLAY_NAME_MAX_LENGTH, INTERNAL_NOTES_MAX_LENGTH
from identity.models import User, UserRole

pytestmark = pytest.mark.django_db

GUESTS_URL = "/api/guests/"
GUEST_API_FIELDS = {
    "id",
    "display_name",
    "email",
    "phone",
    "document_type",
    "document_number",
    "internal_notes",
    "created_at",
    "updated_at",
}


@pytest.fixture
def guest() -> Guest:
    return Guest.objects.create(
        display_name="Ana López",
        email="ana.lopez@example.com",
        phone="+34600123456",
    )


def authenticated_client(role: str) -> APIClient:
    user = User.objects.create_user(
        username=f"{role}-guest-user",
        password="not-used-by-force-authentication",
        role=role,
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def guest_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "display_name": "Ana López",
        "email": "ana.lopez@example.com",
        "phone": "+34600123456",
        "document_type": "dni",
        "document_number": "12345678Z",
        "internal_notes": "Late arrival requested.",
    }
    payload.update(overrides)
    return payload


@pytest.mark.parametrize("role", [UserRole.ADMINISTRATOR, UserRole.MANAGER])
def test_administrator_and_manager_can_list_guests(role: str, guest: Guest) -> None:
    response = authenticated_client(role).get(GUESTS_URL)

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["id"] == guest.pk
    assert set(response.data[0]) == GUEST_API_FIELDS


@pytest.mark.parametrize(
    ("method", "url", "data"),
    [
        ("get", GUESTS_URL, None),
        ("post", GUESTS_URL, guest_payload()),
        ("get", "/api/guests/1/", None),
        ("patch", "/api/guests/1/", {"display_name": "Changed guest"}),
        ("delete", "/api/guests/1/", None),
    ],
)
def test_anonymous_user_cannot_access_guests(
    method: str, url: str, data: dict[str, object] | None
) -> None:
    response = getattr(APIClient(), method)(url, data, format="json")

    assert response.status_code == 401


@pytest.mark.parametrize(
    ("method", "url", "data"),
    [
        ("get", GUESTS_URL, None),
        ("post", GUESTS_URL, guest_payload()),
        ("get", "/api/guests/1/", None),
        ("patch", "/api/guests/1/", {"display_name": "Changed guest"}),
        ("delete", "/api/guests/1/", None),
    ],
)
def test_employee_is_denied_every_guest_endpoint(
    method: str, url: str, data: dict[str, object] | None, guest: Guest
) -> None:
    client = authenticated_client(UserRole.EMPLOYEE)

    response = getattr(client, method)(url, data, format="json")

    assert response.status_code == 403
    assert response.data == {"detail": "Administrator or manager role required."}


def test_manager_can_create_retrieve_update_and_delete_a_guest() -> None:
    client = authenticated_client(UserRole.MANAGER)

    create_response = client.post(
        GUESTS_URL,
        guest_payload(
            display_name="  Ana   María López ",
            email=" ANA.LOPEZ@Example.COM ",
            phone="+34 600-123.456",
            document_type=" dni ",
            document_number=" 12345678-z ",
            internal_notes="  Late arrival requested.  ",
        ),
        format="json",
    )

    assert create_response.status_code == 201
    assert set(create_response.data) == GUEST_API_FIELDS
    assert create_response.data["display_name"] == "Ana María López"
    assert create_response.data["email"] == "ana.lopez@example.com"
    assert create_response.data["phone"] == "+34600123456"
    assert create_response.data["document_type"] == "dni"
    assert create_response.data["document_number"] == "12345678Z"
    assert create_response.data["internal_notes"] == "Late arrival requested."

    guest_id = create_response.data["id"]
    detail_url = f"{GUESTS_URL}{guest_id}/"
    retrieve_response = client.get(detail_url)
    assert retrieve_response.status_code == 200
    assert retrieve_response.data["id"] == guest_id
    created_at = retrieve_response.data["created_at"]

    update_response = client.patch(
        detail_url,
        {
            "display_name": "Ana María López",
            "phone": "+34 600 999 888",
            "internal_notes": "  Updated preference.  ",
        },
        format="json",
    )
    assert update_response.status_code == 200
    assert update_response.data["display_name"] == "Ana María López"
    assert update_response.data["phone"] == "+34600999888"
    assert update_response.data["email"] == "ana.lopez@example.com"
    assert update_response.data["internal_notes"] == "Updated preference."
    assert update_response.data["created_at"] == created_at

    delete_response = client.delete(detail_url)
    assert delete_response.status_code == 204
    assert not Guest.objects.filter(pk=guest_id).exists()


def test_create_guest_without_optional_data_returns_null_contact_fields() -> None:
    response = authenticated_client(UserRole.ADMINISTRATOR).post(
        GUESTS_URL,
        {
            "display_name": "Walk-in guest",
            "email": "   ",
            "phone": "   ",
            "document_type": "",
            "document_number": "",
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["email"] is None
    assert response.data["phone"] is None
    assert response.data["document_type"] is None
    assert response.data["document_number"] is None
    assert response.data["internal_notes"] == ""


def test_create_guest_applies_display_name_limit_to_normalized_value() -> None:
    response = authenticated_client(UserRole.MANAGER).post(
        GUESTS_URL,
        guest_payload(display_name=" " * (DISPLAY_NAME_MAX_LENGTH + 50) + "Ana"),
        format="json",
    )

    assert response.status_code == 201
    assert response.data["display_name"] == "Ana"


def test_create_guest_applies_internal_notes_limit_to_normalized_value() -> None:
    response = authenticated_client(UserRole.MANAGER).post(
        GUESTS_URL,
        guest_payload(internal_notes=" " * (INTERNAL_NOTES_MAX_LENGTH + 50) + "Note"),
        format="json",
    )

    assert response.status_code == 201
    assert response.data["internal_notes"] == "Note"


def test_create_guest_silently_ignores_unknown_sensitive_fields() -> None:
    response = authenticated_client(UserRole.MANAGER).post(
        GUESTS_URL,
        guest_payload(
            identity_document_image="base64-image",
            biometric_data="fingerprint",
            official_traveler_reporting_reference="SES-123",
        ),
        format="json",
    )

    assert response.status_code == 201
    assert set(response.data) == GUEST_API_FIELDS
    guest = Guest.objects.get(pk=response.data["id"])
    assert not any(
        field.name
        in {
            "identity_document_image",
            "biometric_data",
            "official_traveler_reporting_reference",
        }
        for field in guest._meta.fields
    )


@pytest.mark.parametrize(
    ("overrides", "error_field", "expected_message", "expected_code"),
    [
        (
            {"email": "not-an-email"},
            "email",
            None,
            "invalid",
        ),
        (
            {"phone": "call-me"},
            "phone",
            "Phone must contain only digits and common separators.",
            "invalid",
        ),
        (
            {"phone": "٦٠٠١٢٣٤٥٦"},
            "phone",
            "Phone must contain only digits and common separators.",
            "invalid",
        ),
        (
            {"document_number": None},
            "document_number",
            "Document number is required when a document type is provided.",
            "invalid",
        ),
        (
            {"document_type": None},
            "document_type",
            "Document type is required when a document number is provided.",
            "invalid",
        ),
        (
            {"document_type": "passport", "document_number": "A1"},
            "document_number",
            "A passport number must contain 5 to 20 letters or digits.",
            "invalid",
        ),
        (
            {"document_number": "12345678A"},
            "document_number",
            "Document number has an invalid checksum.",
            "invalid",
        ),
        (
            {"document_type": "national_id"},
            "document_type",
            "Unsupported document type.",
            "invalid",
        ),
        (
            {"display_name": "   "},
            "display_name",
            "Display name must not be blank.",
            "invalid",
        ),
        (
            {"internal_notes": "a" * 2001},
            "internal_notes",
            None,
            "max_length",
        ),
    ],
)
def test_create_guest_returns_explicit_field_validation_errors(
    overrides: dict[str, object],
    error_field: str,
    expected_message: str | None,
    expected_code: str,
) -> None:
    response = authenticated_client(UserRole.ADMINISTRATOR).post(
        GUESTS_URL,
        guest_payload(**overrides),
        format="json",
    )

    assert response.status_code == 400
    assert set(response.data) == {error_field}
    error = response.data[error_field][0]
    assert error.code == expected_code
    if expected_message is not None:
        assert str(error) == expected_message


def test_partial_update_cannot_leave_an_unpaired_document_number(guest: Guest) -> None:
    response = authenticated_client(UserRole.MANAGER).patch(
        f"{GUESTS_URL}{guest.pk}/",
        {"document_number": "12345678Z"},
        format="json",
    )

    assert response.status_code == 400
    assert response.data == {
        "document_type": [
            "Document type is required when a document number is provided."
        ]
    }
    guest.refresh_from_db()
    assert guest.document_number is None
