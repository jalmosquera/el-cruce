"""Persistence model for stable public QR-code redirects."""

from uuid import uuid4
from urllib.parse import urlsplit

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _


ALLOWED_PUBLIC_TARGET_PATHS = ("/carta",)


def generate_public_identifier() -> str:
    """Return an opaque URL-safe identifier independent from database IDs."""
    return uuid4().hex


def validate_public_target_path(value: str) -> None:
    """Allow only explicitly registered local public paths.

    The allowlist deliberately prevents QR redirects from becoming an open
    redirect. Adding a destination requires an intentional code and migration
    change so the database invariant stays aligned with the application policy.
    """
    parsed = urlsplit(value)
    if (
        not value.startswith("/")
        or value.startswith("//")
        or parsed.scheme
        or parsed.netloc
        or parsed.query
        or parsed.fragment
        or parsed.path != value
        or value not in ALLOWED_PUBLIC_TARGET_PATHS
    ):
        raise ValidationError(
            _("Target path must be an approved local public path."),
            code="invalid_public_target_path",
        )


class QrCode(models.Model):
    """A permanent opaque QR endpoint that can redirect to mutable public content."""

    identifier = models.CharField(
        default=generate_public_identifier,
        editable=False,
        max_length=32,
        unique=True,
    )
    name = models.CharField(max_length=120)
    target_path = models.CharField(max_length=255, validators=(validate_public_target_path,))
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="created_qr_codes",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name", "pk")
        constraints = [
            models.CheckConstraint(
                condition=Q(name__regex=r"\S"),
                name="qr_codes_name_non_blank",
            ),
            models.CheckConstraint(
                condition=Q(target_path__in=ALLOWED_PUBLIC_TARGET_PATHS),
                name="qr_codes_target_path_is_approved",
            ),
        ]

    def __str__(self) -> str:
        return self.name
