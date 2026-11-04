"""Django application configuration for reservations."""

from django.apps import AppConfig


class ReservationsConfig(AppConfig):
    """Configure the reservations domain."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "reservations"
