"""Django application configuration for employees."""

from django.apps import AppConfig


class EmployeesConfig(AppConfig):
    """Configure employee profiles and shift scheduling."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "employees"
