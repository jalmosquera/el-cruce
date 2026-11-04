"""Django application configuration for identity."""

from django.apps import AppConfig


class IdentityConfig(AppConfig):
    """Configure the internal identity domain."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "identity"
