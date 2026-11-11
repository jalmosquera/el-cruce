"""PostgreSQL-backed tests for approved business configuration APIs."""

from datetime import date

import pytest
from django.core.exceptions import ValidationError
from django.db import DatabaseError, transaction
from django.db.models.deletion import ProtectedError
from rest_framework.test import APIClient

from business_configuration.models import (
    BusinessConfiguration,
    ConfigurationAuditEvent,
    PublicPalette,
)
from identity.models import User, UserRole


pytestmark = pytest.mark.django_db

PUBLIC_URL = "/api/configuration/public/"
SCHEDULE_URL = "/api/configuration/restaurant-schedule/"
ACCOMMODATION_URL = "/api/configuration/accommodation/"
PALETTES_URL = "/api/configuration/palettes/"
DRAFT_PALETTE_URL = "/api/configuration/draft-palette/"
PUBLISH_PALETTE_URL = "/api/configuration/publish-palette/"
OVERVIEW_URL = "/api/configuration/"
PASSWORD = "correct-horse-battery-staple"


def authenticated_client(role: str) -> APIClient:
    user = User.objects.create_user(username=f"{role}-{User.objects.count()}", password=PASSWORD, role=role)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def valid_schedule() -> dict:
    return {
        "weekly_schedules": [
            {"weekday": 0, "opens_at": "09:00", "closes_at": "14:00"},
            {"weekday": 0, "opens_at": "20:00", "closes_at": "01:00"},
        ],
        "special_schedules": [
            {
                "date": "2027-01-06",
                "is_closed": False,
                "intervals": [{"opens_at": "12:00", "closes_at": "23:00"}],
            }
        ],
    }


@pytest.mark.parametrize("role", (UserRole.MANAGER, UserRole.ADMINISTRATOR))
def test_manager_and_administrator_can_replace_restaurant_schedule(role: str) -> None:
    response = authenticated_client(role).put(SCHEDULE_URL, valid_schedule(), format="json")

    assert response.status_code == 200
    assert response.data["timezone"] == "Europe/Madrid"
    assert response.data["weekly_schedules"][1]["closes_at"] == "01:00:00"
    assert ConfigurationAuditEvent.objects.get().event_type == "restaurant_schedule_replaced"


def test_schedule_rejects_overlaps_across_a_cross_midnight_week_boundary() -> None:
    payload = {
        "weekly_schedules": [
            {"weekday": 6, "opens_at": "22:00", "closes_at": "02:00"},
            {"weekday": 0, "opens_at": "01:00", "closes_at": "03:00"},
        ]
    }

    response = authenticated_client(UserRole.MANAGER).put(SCHEDULE_URL, payload, format="json")

    assert response.status_code == 400
    assert "weekly_schedules" in response.data


def test_schedule_rejects_overlapping_special_intervals_and_closed_intervals() -> None:
    client = authenticated_client(UserRole.MANAGER)
    response = client.put(
        SCHEDULE_URL,
        {
            "weekly_schedules": [],
            "special_schedules": [
                {
                    "date": "2027-01-06",
                    "is_closed": False,
                    "intervals": [
                        {"opens_at": "12:00", "closes_at": "18:00"},
                        {"opens_at": "17:00", "closes_at": "21:00"},
                    ],
                }
            ],
        },
        format="json",
    )

    assert response.status_code == 400
    assert "special_schedules" in response.data

    closed = client.put(
        SCHEDULE_URL,
        {
            "weekly_schedules": [],
            "special_schedules": [
                {
                    "date": "2027-01-06",
                    "is_closed": True,
                    "intervals": [{"opens_at": "12:00", "closes_at": "18:00"}],
                }
            ],
        },
        format="json",
    )
    assert closed.status_code == 400


def test_schedule_rejects_cross_midnight_special_overlap_with_the_next_date() -> None:
    response = authenticated_client(UserRole.MANAGER).put(
        SCHEDULE_URL,
        {
            "weekly_schedules": [],
            "special_schedules": [
                {
                    "date": "2027-01-06",
                    "is_closed": False,
                    "intervals": [{"opens_at": "22:00", "closes_at": "02:00"}],
                },
                {
                    "date": "2027-01-07",
                    "is_closed": False,
                    "intervals": [{"opens_at": "01:00", "closes_at": "03:00"}],
                },
            ],
        },
        format="json",
    )

    assert response.status_code == 400
    assert "special_schedules" in response.data


def test_employee_and_anonymous_users_cannot_mutate_configuration() -> None:
    assert APIClient().put(SCHEDULE_URL, valid_schedule(), format="json").status_code == 401
    assert authenticated_client(UserRole.EMPLOYEE).put(
        SCHEDULE_URL, valid_schedule(), format="json"
    ).status_code == 403


@pytest.mark.parametrize(
    ("method", "url"),
    (
        ("get", OVERVIEW_URL),
        ("get", SCHEDULE_URL),
        ("get", ACCOMMODATION_URL),
        ("get", PALETTES_URL),
        ("post", PALETTES_URL),
        ("put", DRAFT_PALETTE_URL),
        ("post", PUBLISH_PALETTE_URL),
    ),
)
def test_employee_and_anonymous_users_cannot_access_other_internal_configuration_routes(
    method: str, url: str
) -> None:
    payload = {} if method != "get" else None
    assert getattr(APIClient(), method)(url, payload, format="json").status_code == 401
    assert getattr(authenticated_client(UserRole.EMPLOYEE), method)(
        url, payload, format="json"
    ).status_code == 403


def test_accommodation_settings_require_complete_intervals_and_replace_exceptions() -> None:
    client = authenticated_client(UserRole.MANAGER)
    invalid = client.put(ACCOMMODATION_URL, {"check_in_from": "15:00"}, format="json")
    assert invalid.status_code == 400
    assert "check_in_until" in invalid.data

    response = client.put(
        ACCOMMODATION_URL,
        {
            "check_in_from": "15:00",
            "check_in_until": "22:00",
            "check_out_from": "08:00",
            "check_out_until": "12:00",
            "reception_from": "09:00",
            "reception_until": "21:00",
            "accommodation_instructions": "Llame al timbre al llegar.",
            "exceptions": [{"date": "2027-01-06", "description": "Recepción reducida."}],
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.data["exceptions"] == [
        {"date": "2027-01-06", "description": "Recepción reducida."}
    ]


def test_predefined_palettes_match_owner_constants_and_are_immutable() -> None:
    palettes = {palette.key: palette for palette in PublicPalette.objects.filter(is_predefined=True)}

    assert len(palettes) == 5
    assert palettes["tierra-elegante"].primary == "#583F44"
    assert palettes["mediterraneo"].accent == "#C28B58"
    palette = palettes["tierra-elegante"]
    palette.primary = "#000000"
    with pytest.raises(ValidationError):
        palette.save()
    with pytest.raises(ValidationError):
        palette.delete()


def test_custom_palette_requires_five_valid_hex_colours() -> None:
    response = authenticated_client(UserRole.MANAGER).post(
        PALETTES_URL,
        {
            "key": "custom-hotel",
            "name": "Custom Hotel",
            "primary": "#102030",
            "background": "#FFFFFF",
            "text": "bad",
            "secondary": "#405060",
            "accent": "#708090",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "text" in response.data


def test_draft_palette_is_private_and_inaccessible_palette_cannot_be_published() -> None:
    client = authenticated_client(UserRole.MANAGER)
    palette = client.post(
        PALETTES_URL,
        {
            "key": "low-contrast",
            "name": "Low contrast",
            "primary": "#eeeeee",
            "background": "#ffffff",
            "text": "#eeeeee",
            "secondary": "#cccccc",
            "accent": "#bbbbbb",
        },
        format="json",
    )
    assert palette.status_code == 201
    assert client.put(DRAFT_PALETTE_URL, {"palette_id": palette.data["id"]}, format="json").status_code == 200

    public_response = APIClient().get(PUBLIC_URL)
    assert public_response.status_code == 200
    assert public_response.data["palette"] is None

    publish_response = client.post(PUBLISH_PALETTE_URL, format="json")
    assert publish_response.status_code == 400
    assert "palette" in publish_response.data
    assert BusinessConfiguration.get_solo().published_palette is None


def test_public_configuration_does_not_create_the_singleton_state() -> None:
    assert BusinessConfiguration.objects.count() == 0

    response = APIClient().get(PUBLIC_URL)

    assert response.status_code == 200
    assert response.data["palette"] is None
    assert response.data["accommodation"]["exceptions"] == []
    assert BusinessConfiguration.objects.count() == 0


def test_custom_palette_and_audit_write_are_atomic(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail_audit(**kwargs) -> None:
        raise RuntimeError("audit storage unavailable")

    monkeypatch.setattr("business_configuration.views.record_audit_event", fail_audit)
    response = authenticated_client(UserRole.MANAGER).post(
        PALETTES_URL,
        {
            "key": "rollback-palette",
            "name": "Rollback palette",
            "primary": "#102030",
            "background": "#FFFFFF",
            "text": "#102030",
            "secondary": "#405060",
            "accent": "#708090",
        },
        format="json",
    )

    assert response.status_code == 500
    assert not PublicPalette.objects.filter(key="rollback-palette").exists()
    assert not ConfigurationAuditEvent.objects.filter(event_type="custom_palette_created").exists()


def test_draft_palette_and_audit_write_are_atomic(monkeypatch: pytest.MonkeyPatch) -> None:
    palette = PublicPalette.objects.get(key="tierra-elegante")

    def fail_audit(**kwargs) -> None:
        raise RuntimeError("audit storage unavailable")

    monkeypatch.setattr("business_configuration.views.record_audit_event", fail_audit)
    response = authenticated_client(UserRole.MANAGER).put(
        DRAFT_PALETTE_URL, {"palette_id": palette.pk}, format="json"
    )

    assert BusinessConfiguration.objects.count() == 0
    assert response.status_code == 500
    assert BusinessConfiguration.objects.count() == 0
    assert not ConfigurationAuditEvent.objects.filter(event_type="draft_palette_selected").exists()


def test_public_configuration_exposes_only_the_published_palette() -> None:
    client = authenticated_client(UserRole.ADMINISTRATOR)
    palette = PublicPalette.objects.get(key="tierra-elegante")
    client.put(DRAFT_PALETTE_URL, {"palette_id": palette.pk}, format="json")
    assert client.post(PUBLISH_PALETTE_URL, format="json").status_code == 200

    response = APIClient().get(PUBLIC_URL)

    assert response.status_code == 200
    assert response.data["palette"]["key"] == "tierra-elegante"
    assert "draft_palette" not in response.data


def test_audit_events_cannot_be_updated_or_deleted() -> None:
    event = ConfigurationAuditEvent.objects.create(event_type="test", payload={"date": str(date.today())})
    event.event_type = "changed"
    with pytest.raises(ValidationError):
        event.save()
    with pytest.raises(ValidationError):
        event.delete()
    with pytest.raises(DatabaseError), transaction.atomic():
        ConfigurationAuditEvent.objects.filter(pk=event.pk).update(event_type="changed")


def test_audit_event_preserves_its_actor_by_protecting_actor_deletion() -> None:
    user = User.objects.create_user(username="audited-manager", password=PASSWORD, role=UserRole.MANAGER)
    event = ConfigurationAuditEvent.objects.create(event_type="test", actor=user)

    with pytest.raises(ProtectedError):
        user.delete()

    event.refresh_from_db()
    assert event.actor_id == user.pk
