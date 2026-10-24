"""Development settings using the required PostgreSQL database."""

from .base import *  # noqa: F403 - Environment modules intentionally inherit base settings.
from .base import (
    get_boolean_environment_value,
    get_csv_environment_value,
    get_postgresql_database_settings,
)


DEBUG = get_boolean_environment_value("DJANGO_DEBUG", default=True)
ALLOWED_HOSTS = get_csv_environment_value(
    "DJANGO_ALLOWED_HOSTS", default=("localhost", "127.0.0.1")
)

DATABASES = {"default": get_postgresql_database_settings()}
