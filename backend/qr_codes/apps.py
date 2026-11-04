"""Django application configuration for permanent QR codes."""

from django.apps import AppConfig


class QrCodesConfig(AppConfig):
    """Configure the QR-code domain."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "qr_codes"
