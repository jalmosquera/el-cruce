"""HTTP serializers for the guests domain."""

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail

from .models import Guest
from .normalization import (
    DOCUMENT_NUMBER_MAX_LENGTH,
    EMAIL_MAX_LENGTH,
    PHONE_MAX_LENGTH,
    normalize_guest_data,
)

GUEST_FIELDS = (
    "display_name",
    "email",
    "phone",
    "document_type",
    "document_number",
    "internal_notes",
)


class GuestSerializer(serializers.ModelSerializer):
    """Validate, normalize and represent the internal guest resource."""

    display_name = serializers.CharField(
        trim_whitespace=False,
    )
    email = serializers.EmailField(
        allow_blank=True,
        allow_null=True,
        max_length=EMAIL_MAX_LENGTH,
        required=False,
    )
    phone = serializers.CharField(
        allow_blank=True,
        allow_null=True,
        max_length=PHONE_MAX_LENGTH,
        required=False,
    )
    document_type = serializers.CharField(
        allow_blank=True,
        allow_null=True,
        max_length=20,
        required=False,
    )
    document_number = serializers.CharField(
        allow_blank=True,
        allow_null=True,
        max_length=DOCUMENT_NUMBER_MAX_LENGTH,
        required=False,
    )
    internal_notes = serializers.CharField(
        allow_blank=True,
        required=False,
    )

    class Meta:
        model = Guest
        fields = (
            "id",
            *GUEST_FIELDS,
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attributes: dict[str, object]) -> dict[str, object]:
        """Apply the shared guest normalization rules to the complete record."""
        current_values = {}
        if self.instance is not None:
            current_values = {
                field_name: getattr(self.instance, field_name)
                for field_name in GUEST_FIELDS
            }
        merged_values = {**current_values, **attributes}

        try:
            return normalize_guest_data(**merged_values)
        except DjangoValidationError as error:
            raise serializers.ValidationError(self._error_detail(error)) from error

    @staticmethod
    def _error_detail(error: DjangoValidationError) -> dict[str, list[ErrorDetail]]:
        """Preserve the guest API's stable validation error codes."""
        return {
            field_name: [
                ErrorDetail(
                    message,
                    code=(
                        "max_length"
                        if field_error.code == "max_length"
                        else "invalid"
                    ),
                )
                for field_error in field_errors
                for message in field_error.messages
            ]
            for field_name, field_errors in error.error_dict.items()
        }
