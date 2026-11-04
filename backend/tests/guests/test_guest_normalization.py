"""Unit tests for explicit guest data normalization and validation rules."""

import pytest
from django.core.exceptions import ValidationError

from guests.normalization import (
    DISPLAY_NAME_MAX_LENGTH,
    DOCUMENT_NUMBER_MAX_LENGTH,
    EMAIL_MAX_LENGTH,
    INTERNAL_NOTES_MAX_LENGTH,
    GuestDocumentType,
    normalize_display_name,
    normalize_document_number,
    normalize_document_type,
    normalize_email,
    normalize_guest_data,
    normalize_internal_notes,
    normalize_phone,
    validate_document_number,
)


def test_normalize_display_name_collapses_whitespace() -> None:
    assert normalize_display_name("  Ana   María \t López  ") == "Ana María López"


def test_normalize_display_name_applies_length_limit_to_normalized_value() -> None:
    assert normalize_display_name(" " * (DISPLAY_NAME_MAX_LENGTH + 50) + "Ana") == "Ana"


@pytest.mark.parametrize(
    ("value", "code"),
    [
        (None, "blank"),
        ("   ", "blank"),
        ("A" * (DISPLAY_NAME_MAX_LENGTH + 1), "max_length"),
    ],
)
def test_normalize_display_name_rejects_blank_or_excessive_values(
    value: str | None, code: str
) -> None:
    with pytest.raises(ValidationError) as error:
        normalize_display_name(value)

    assert error.value.error_list[0].code == code


def test_normalize_email_trims_and_lowercases_a_valid_address() -> None:
    assert normalize_email("  ANA.LOPEZ@Example.COM ") == "ana.lopez@example.com"


@pytest.mark.parametrize("value", [None, "", "   "])
def test_normalize_email_treats_blank_values_as_absent(value: str | None) -> None:
    assert normalize_email(value) is None


@pytest.mark.parametrize(
    ("value", "code"),
    [
        ("not-an-email", "invalid"),
        ("a" * EMAIL_MAX_LENGTH + "@example.com", "max_length"),
    ],
)
def test_normalize_email_rejects_invalid_or_excessive_values(
    value: str, code: str
) -> None:
    with pytest.raises(ValidationError) as error:
        normalize_email(value)

    assert error.value.error_list[0].code == code


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("+34 600-123.456", "+34600123456"),
        ("600 123 456", "600123456"),
        ("(600) 123/456", "600123456"),
    ],
)
def test_normalize_phone_removes_common_formatting(value: str, expected: str) -> None:
    assert normalize_phone(value) == expected


@pytest.mark.parametrize("value", [None, "", "   "])
def test_normalize_phone_treats_blank_values_as_absent(value: str | None) -> None:
    assert normalize_phone(value) is None


@pytest.mark.parametrize("value", ["٦٠٠١٢٣٤٥٦", "６００１２３４５６"])
def test_normalize_phone_rejects_non_ascii_unicode_digits(value: str) -> None:
    with pytest.raises(ValidationError) as error:
        normalize_phone(value)

    assert error.value.error_list[0].code == "invalid"


@pytest.mark.parametrize("value", ["call-me", "12345", "1" * 16, "+"])
def test_normalize_phone_rejects_invalid_values(value: str) -> None:
    with pytest.raises(ValidationError) as error:
        normalize_phone(value)

    assert error.value.error_list[0].code == "invalid"


def test_normalize_internal_notes_trims_content() -> None:
    assert normalize_internal_notes("  Quiet room requested.  ") == (
        "Quiet room requested."
    )
    assert normalize_internal_notes("   ") == ""


def test_normalize_internal_notes_rejects_excessive_content() -> None:
    with pytest.raises(ValidationError) as error:
        normalize_internal_notes("a" * (INTERNAL_NOTES_MAX_LENGTH + 1))

    assert error.value.error_list[0].code == "max_length"


def test_normalize_internal_notes_applies_length_limit_to_normalized_value() -> None:
    assert normalize_internal_notes(" " * (INTERNAL_NOTES_MAX_LENGTH + 50) + "Note") == (
        "Note"
    )


def test_normalize_document_type_lowercases_supported_values() -> None:
    assert normalize_document_type(" DNI ") == GuestDocumentType.DNI
    assert normalize_document_type(None) is None
    assert normalize_document_type("   ") is None


def test_normalize_document_type_rejects_unsupported_values() -> None:
    with pytest.raises(ValidationError) as error:
        normalize_document_type("national_id")

    assert error.value.error_list[0].code == "invalid_choice"


def test_normalize_document_number_removes_formatting_and_uppercases() -> None:
    assert normalize_document_number(" 12345678-z ") == "12345678Z"


@pytest.mark.parametrize("value", [None, "", "   "])
def test_normalize_document_number_treats_blank_values_as_absent(
    value: str | None,
) -> None:
    assert normalize_document_number(value) is None


@pytest.mark.parametrize(
    ("value", "code"),
    [
        ("AB/12", "invalid"),
        ("A" * (DOCUMENT_NUMBER_MAX_LENGTH + 1), "max_length"),
    ],
)
def test_normalize_document_number_rejects_invalid_or_excessive_values(
    value: str, code: str
) -> None:
    with pytest.raises(ValidationError) as error:
        normalize_document_number(value)

    assert error.value.error_list[0].code == code


@pytest.mark.parametrize(
    ("document_type", "document_number"),
    [
        (GuestDocumentType.DNI, "12345678Z"),
        (GuestDocumentType.NIE, "X1234567L"),
        (GuestDocumentType.PASSPORT, "AB123456"),
        (GuestDocumentType.OTHER, "CU123"),
    ],
)
def test_validate_document_number_accepts_supported_formats(
    document_type: str, document_number: str
) -> None:
    validate_document_number(document_type, document_number)


@pytest.mark.parametrize(
    ("document_type", "document_number", "expected_message"),
    [
        (GuestDocumentType.DNI, "1234567Z", "A DNI must contain"),
        (GuestDocumentType.DNI, "12345678A", "invalid checksum"),
        (GuestDocumentType.NIE, "A1234567L", "A NIE must contain"),
        (GuestDocumentType.NIE, "X1234567C", "invalid checksum"),
        (GuestDocumentType.PASSPORT, "A1", "A passport number must contain"),
        (GuestDocumentType.OTHER, "A1", "A document number must contain"),
    ],
)
def test_validate_document_number_rejects_invalid_formats(
    document_type: str, document_number: str, expected_message: str
) -> None:
    with pytest.raises(ValidationError, match=expected_message):
        validate_document_number(document_type, document_number)


def test_normalize_guest_data_returns_the_complete_normalized_record() -> None:
    assert normalize_guest_data(
        display_name="  Ana   María López ",
        email=" ANA@Example.COM ",
        phone="+34 600-123.456",
        document_type=" dni ",
        document_number=" 12345678-z ",
        internal_notes="  Late arrival.  ",
    ) == {
        "display_name": "Ana María López",
        "email": "ana@example.com",
        "phone": "+34600123456",
        "document_type": "dni",
        "document_number": "12345678Z",
        "internal_notes": "Late arrival.",
    }


@pytest.mark.parametrize(
    ("document_type", "document_number", "error_field"),
    [
        ("dni", None, "document_number"),
        (None, "12345678Z", "document_type"),
    ],
)
def test_normalize_guest_data_enforces_document_field_pairing(
    document_type: str | None,
    document_number: str | None,
    error_field: str,
) -> None:
    with pytest.raises(ValidationError) as error:
        normalize_guest_data(
            display_name="Ana López",
            document_type=document_type,
            document_number=document_number,
        )

    assert error_field in error.value.message_dict


def test_normalize_guest_data_reports_all_invalid_fields_together() -> None:
    with pytest.raises(ValidationError) as error:
        normalize_guest_data(
            display_name="   ",
            email="not-an-email",
            phone="call-me",
            document_type="national_id",
            document_number="AB/12",
        )

    assert set(error.value.message_dict) == {
        "display_name",
        "email",
        "phone",
        "document_type",
        "document_number",
    }
