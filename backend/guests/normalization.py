"""Explicit normalization and validation for minimized operational guest data."""

import re

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import models

DISPLAY_NAME_MAX_LENGTH = 150
EMAIL_MAX_LENGTH = 254
PHONE_MAX_LENGTH = 32
DOCUMENT_NUMBER_MAX_LENGTH = 32
INTERNAL_NOTES_MAX_LENGTH = 2000

_PHONE_SEPARATORS = re.compile(r"[\s\-.()/]")
_PHONE_DIGITS = re.compile(r"^[0-9]+$")
_DOCUMENT_SEPARATORS = re.compile(r"[\s\-]")
_DOCUMENT_CONTENT = re.compile(r"^[A-Z0-9]+$")
_PASSPORT_PATTERN = re.compile(r"^[A-Z0-9]{5,20}$")
_OTHER_DOCUMENT_PATTERN = re.compile(r"^[A-Z0-9]{3,32}$")
_DOCUMENT_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE"
_NIE_PREFIX_DIGITS = {"X": "0", "Y": "1", "Z": "2"}


class GuestDocumentType(models.TextChoices):
    """Document categories that may be recorded for internal identification."""

    DNI = "dni", "DNI"
    NIE = "nie", "NIE"
    PASSPORT = "passport", "Passport"
    OTHER = "other", "Other"


def normalize_display_name(value: str | None) -> str:
    """Collapse insignificant whitespace and require a non-empty display name."""
    normalized_value = " ".join((value or "").split())
    if not normalized_value:
        raise ValidationError("Display name must not be blank.", code="blank")
    if len(normalized_value) > DISPLAY_NAME_MAX_LENGTH:
        raise ValidationError(
            f"Display name must be at most {DISPLAY_NAME_MAX_LENGTH} characters.",
            code="max_length",
        )
    return normalized_value


def normalize_email(value: str | None) -> str | None:
    """Trim, lowercase and validate an optional contact email address."""
    if value is None:
        return None

    normalized_value = value.strip().lower()
    if not normalized_value:
        return None
    if len(normalized_value) > EMAIL_MAX_LENGTH:
        raise ValidationError(
            f"Email must be at most {EMAIL_MAX_LENGTH} characters.",
            code="max_length",
        )

    try:
        validate_email(normalized_value)
    except ValidationError as error:
        raise ValidationError("Enter a valid email address.", code="invalid") from error
    return normalized_value


def normalize_phone(value: str | None) -> str | None:
    """Normalize an optional phone number to digits with an optional leading plus."""
    if value is None:
        return None

    stripped_value = value.strip()
    if not stripped_value:
        return None

    has_country_prefix = stripped_value.startswith("+")
    if has_country_prefix:
        stripped_value = stripped_value[1:]

    compact_value = _PHONE_SEPARATORS.sub("", stripped_value)
    if not _PHONE_DIGITS.fullmatch(compact_value):
        raise ValidationError(
            "Phone must contain only digits and common separators.",
            code="invalid",
        )
    if not 6 <= len(compact_value) <= 15:
        raise ValidationError(
            "Phone must contain between 6 and 15 digits.",
            code="invalid",
        )
    return f"+{compact_value}" if has_country_prefix else compact_value


def normalize_internal_notes(value: str | None) -> str:
    """Trim optional operational notes and enforce a bounded size."""
    normalized_value = (value or "").strip()
    if len(normalized_value) > INTERNAL_NOTES_MAX_LENGTH:
        raise ValidationError(
            f"Internal notes must be at most {INTERNAL_NOTES_MAX_LENGTH} characters.",
            code="max_length",
        )
    return normalized_value


def normalize_document_type(value: str | None) -> str | None:
    """Normalize and restrict the optional document category."""
    if value is None:
        return None

    normalized_value = value.strip().lower()
    if not normalized_value:
        return None
    if normalized_value not in GuestDocumentType.values:
        raise ValidationError("Unsupported document type.", code="invalid_choice")
    return normalized_value


def normalize_document_number(value: str | None) -> str | None:
    """Normalize an optional document number without retaining formatting."""
    if value is None:
        return None

    normalized_value = _DOCUMENT_SEPARATORS.sub("", value.strip()).upper()
    if not normalized_value:
        return None
    if len(normalized_value) > DOCUMENT_NUMBER_MAX_LENGTH:
        raise ValidationError(
            f"Document number must be at most {DOCUMENT_NUMBER_MAX_LENGTH} characters.",
            code="max_length",
        )
    if not _DOCUMENT_CONTENT.fullmatch(normalized_value):
        raise ValidationError(
            "Document number must contain only letters and digits.",
            code="invalid",
        )
    return normalized_value


def _validate_spanish_document_checksum(number: str, numeric_part: str) -> None:
    """Validate the control letter shared by DNI and NIE documents."""
    expected_letter = _DOCUMENT_LETTERS[int(numeric_part) % 23]
    if number[-1] != expected_letter:
        raise ValidationError(
            "Document number has an invalid checksum.",
            code="invalid",
        )


def validate_document_number(document_type: str, document_number: str) -> None:
    """Validate document numbering rules for the selected document category."""
    if document_type == GuestDocumentType.DNI:
        if len(document_number) != 9 or not document_number[:8].isdigit():
            raise ValidationError(
                "A DNI must contain 8 digits followed by a control letter.",
                code="invalid",
            )
        _validate_spanish_document_checksum(document_number, document_number[:8])
        return

    if document_type == GuestDocumentType.NIE:
        if (
            len(document_number) != 9
            or document_number[0] not in _NIE_PREFIX_DIGITS
            or not document_number[1:8].isdigit()
        ):
            raise ValidationError(
                "A NIE must contain X, Y or Z, 7 digits and a control letter.",
                code="invalid",
            )
        numeric_part = _NIE_PREFIX_DIGITS[document_number[0]] + document_number[1:8]
        _validate_spanish_document_checksum(document_number, numeric_part)
        return

    if document_type == GuestDocumentType.PASSPORT:
        if not _PASSPORT_PATTERN.fullmatch(document_number):
            raise ValidationError(
                "A passport number must contain 5 to 20 letters or digits.",
                code="invalid",
            )
        return

    if not _OTHER_DOCUMENT_PATTERN.fullmatch(document_number):
        raise ValidationError(
            "A document number must contain 3 to 32 letters or digits.",
            code="invalid",
        )


def normalize_guest_data(
    *,
    display_name: str | None,
    email: str | None = None,
    phone: str | None = None,
    document_type: str | None = None,
    document_number: str | None = None,
    internal_notes: str | None = None,
) -> dict[str, str | None]:
    """Normalize and validate the complete operational guest payload."""
    errors: dict[str, list[ValidationError]] = {}
    normalized: dict[str, str | None] = {}

    normalizers = (
        ("display_name", display_name, normalize_display_name),
        ("email", email, normalize_email),
        ("phone", phone, normalize_phone),
        ("internal_notes", internal_notes, normalize_internal_notes),
    )
    for field_name, value, normalizer in normalizers:
        try:
            normalized[field_name] = normalizer(value)
        except ValidationError as error:
            errors[field_name] = error.error_list

    normalized_document_type: str | None = None
    normalized_document_number: str | None = None
    try:
        normalized_document_type = normalize_document_type(document_type)
    except ValidationError as error:
        errors["document_type"] = error.error_list
    try:
        normalized_document_number = normalize_document_number(document_number)
    except ValidationError as error:
        errors["document_number"] = error.error_list

    if "document_type" not in errors and "document_number" not in errors:
        if normalized_document_type is None and normalized_document_number is not None:
            errors["document_type"] = [
                ValidationError(
                    "Document type is required when a document number is provided.",
                    code="invalid",
                )
            ]
        elif normalized_document_type is not None and normalized_document_number is None:
            errors["document_number"] = [
                ValidationError(
                    "Document number is required when a document type is provided.",
                    code="invalid",
                )
            ]
        elif normalized_document_type is not None and normalized_document_number is not None:
            try:
                validate_document_number(
                    normalized_document_type, normalized_document_number
                )
            except ValidationError as error:
                errors["document_number"] = error.error_list

    if errors:
        raise ValidationError(errors)

    normalized["document_type"] = normalized_document_type
    normalized["document_number"] = normalized_document_number
    return normalized
