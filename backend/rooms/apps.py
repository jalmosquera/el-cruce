"""Django application configuration for rooms."""

from django.apps import AppConfig


class RoomsConfig(AppConfig):
    """Configure the rooms domain."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "rooms"
