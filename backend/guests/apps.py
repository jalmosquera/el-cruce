"""Django application configuration for internal guest management."""

from django.apps import AppConfig


class GuestsConfig(AppConfig):
    """Configure the guests domain."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "guests"
