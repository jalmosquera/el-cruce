"""Django application configuration for the menu domain."""

from django.apps import AppConfig


class MenuConfig(AppConfig):
    """Configure the restaurant menu domain."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "menu"
