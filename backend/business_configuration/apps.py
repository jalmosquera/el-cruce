"""Django application configuration for business settings."""

from django.apps import AppConfig


class BusinessConfigurationConfig(AppConfig):
    """Configure the business configuration domain."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "business_configuration"
