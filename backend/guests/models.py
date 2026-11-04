"""Persistence models for minimized operational guest records."""

from django.core.validators import MaxLengthValidator
from django.db import models
from django.db.models import Q

from .normalization import (
    DISPLAY_NAME_MAX_LENGTH,
    DOCUMENT_NUMBER_MAX_LENGTH,
    EMAIL_MAX_LENGTH,
    INTERNAL_NOTES_MAX_LENGTH,
    PHONE_MAX_LENGTH,
    GuestDocumentType,
    normalize_guest_data,
)


class Guest(models.Model):
    """An internally managed guest with only operational identification data."""

    display_name = models.CharField(max_length=DISPLAY_NAME_MAX_LENGTH)
    email = models.EmailField(max_length=EMAIL_MAX_LENGTH, null=True, blank=True)
    phone = models.CharField(max_length=PHONE_MAX_LENGTH, null=True, blank=True)
    document_type = models.CharField(
        choices=GuestDocumentType.choices,
        max_length=20,
        null=True,
        blank=True,
    )
    document_number = models.CharField(
        max_length=DOCUMENT_NUMBER_MAX_LENGTH,
        null=True,
        blank=True,
    )
    internal_notes = models.TextField(
        blank=True,
        default="",
        validators=[MaxLengthValidator(INTERNAL_NOTES_MAX_LENGTH)],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("display_name", "pk")
        constraints = [
            models.CheckConstraint(
                condition=Q(display_name__regex=r"\S"),
                name="guests_guest_display_name_not_blank",
            ),
            models.CheckConstraint(
                condition=(
                    Q(document_type__isnull=True, document_number__isnull=True)
                    | Q(document_type__isnull=False, document_number__isnull=False)
                ),
                name="guests_guest_document_pair",
            ),
            models.CheckConstraint(
                condition=(
                    Q(document_type__isnull=True)
                    | Q(document_type__in=GuestDocumentType.values)
                ),
                name="guests_guest_document_type_valid",
            ),
            models.CheckConstraint(
                condition=(
                    Q(document_number__isnull=True)
                    | Q(document_number__regex=r"\S")
                ),
                name="guests_guest_document_number_not_blank",
            ),
        ]

    def __str__(self) -> str:
        return self.display_name

    def full_clean(self, *args, **kwargs) -> None:
        """Normalize before field validation so limits apply to normalized values."""
        self._apply_normalization()
        super().full_clean(*args, **kwargs)

    def clean(self) -> None:
        """Validate and normalize every operational guest field."""
        super().clean()
        self._apply_normalization()

    def save(self, *args, **kwargs) -> None:
        """Normalize data before persistence for every ORM write path."""
        self._apply_normalization()
        super().save(*args, **kwargs)

    def _apply_normalization(self) -> None:
        normalized_data = normalize_guest_data(
            display_name=self.display_name,
            email=self.email,
            phone=self.phone,
            document_type=self.document_type,
            document_number=self.document_number,
            internal_notes=self.internal_notes,
        )
        for field_name, value in normalized_data.items():
            setattr(self, field_name, value)
