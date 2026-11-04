"""PostgreSQL-backed model tests for minimized guest records."""

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, models, transaction

from guests.models import Guest
from guests.normalization import (
    DISPLAY_NAME_MAX_LENGTH,
    INTERNAL_NOTES_MAX_LENGTH,
    GuestDocumentType,
)

pytestmark = pytest.mark.django_db

EXPECTED_MODEL_FIELDS = {
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


def test_guest_model_persists_only_minimized_operational_fields() -> None:
    assert {field.name for field in Guest._meta.fields} == EXPECTED_MODEL_FIELDS
    assert not any(
        isinstance(field, (models.BinaryField, models.FileField, models.ImageField))
        for field in Guest._meta.fields
    )


def test_guest_model_normalizes_all_operational_fields_on_save() -> None:
    guest = Guest.objects.create(
        display_name="  Ana   María López ",
        email=" ANA.LOPEZ@Example.COM ",
        phone="+34 600-123.456",
        document_type=" dni ",
        document_number=" 12345678-z ",
        internal_notes="  Late arrival requested.  ",
    )

    assert guest.display_name == "Ana María López"
    assert guest.email == "ana.lopez@example.com"
    assert guest.phone == "+34600123456"
    assert guest.document_type == GuestDocumentType.DNI
    assert guest.document_number == "12345678Z"
    assert guest.internal_notes == "Late arrival requested."
    assert guest.created_at is not None
    assert guest.updated_at is not None
    assert str(guest) == "Ana María López"


def test_guest_model_validation_applies_length_limits_to_normalized_values() -> None:
    guest = Guest(
        display_name=" " * (DISPLAY_NAME_MAX_LENGTH + 50) + "Ana",
        internal_notes=" " * (INTERNAL_NOTES_MAX_LENGTH + 50) + "Note",
    )

    guest.full_clean()

    assert guest.display_name == "Ana"
    assert guest.internal_notes == "Note"


def test_guest_model_stores_blank_optional_values_as_absent() -> None:
    guest = Guest.objects.create(
        display_name="Ana López",
        email="   ",
        phone="   ",
        document_type="   ",
        document_number="   ",
        internal_notes="   ",
    )

    assert guest.email is None
    assert guest.phone is None
    assert guest.document_type is None
    assert guest.document_number is None
    assert guest.internal_notes == ""


@pytest.mark.parametrize(
    ("overrides", "error_field", "expected_message"),
    [
        ({"display_name": "   "}, "display_name", "Display name must not be blank."),
        (
            {"phone": "call-me"},
            "phone",
            "Phone must contain only digits and common separators.",
        ),
        (
            {"document_type": "dni"},
            "document_number",
            "Document number is required when a document type is provided.",
        ),
        (
            {"document_number": "12345678Z"},
            "document_type",
            "Document type is required when a document number is provided.",
        ),
        (
            {"document_type": "national_id", "document_number": "AB123"},
            "document_type",
            "Unsupported document type.",
        ),
        (
            {"document_type": "dni", "document_number": "12345678A"},
            "document_number",
            "Document number has an invalid checksum.",
        ),
    ],
)
def test_guest_model_validation_rejects_invalid_data(
    overrides: dict[str, str], error_field: str, expected_message: str
) -> None:
    values = {"display_name": "Ana López", **overrides}
    guest = Guest(**values)

    with pytest.raises(ValidationError) as error:
        guest.full_clean()

    assert any(
        expected_message in str(message)
        for message in error.value.message_dict[error_field]
    )


def test_guest_model_validation_rejects_an_invalid_email() -> None:
    guest = Guest(display_name="Ana López", email="not-an-email")

    with pytest.raises(ValidationError) as error:
        guest.full_clean()

    assert "email" in error.value.message_dict
    assert error.value.error_dict["email"][0].code == "invalid"


def test_database_rejects_a_whitespace_only_display_name(guest: Guest) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        Guest.objects.filter(pk=guest.pk).update(display_name="   ")


def test_database_rejects_an_unpaired_document_type(guest: Guest) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        Guest.objects.filter(pk=guest.pk).update(document_type=GuestDocumentType.DNI)


def test_database_rejects_an_unpaired_document_number(guest: Guest) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        Guest.objects.filter(pk=guest.pk).update(document_number="12345678Z")


def test_database_rejects_an_unsupported_document_type(guest: Guest) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        Guest.objects.filter(pk=guest.pk).update(
            document_type="national_id",
            document_number="AB123",
        )


def test_database_rejects_a_blank_document_number(guest: Guest) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        Guest.objects.filter(pk=guest.pk).update(
            document_type=GuestDocumentType.OTHER,
            document_number="   ",
        )


@pytest.fixture
def guest() -> Guest:
    return Guest.objects.create(display_name="Ana López")
