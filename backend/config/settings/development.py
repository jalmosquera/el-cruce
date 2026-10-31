"""Development settings using the required PostgreSQL database."""

from .base import *  # noqa: F403 - Environment modules intentionally inherit base settings.
from .base import (
    get_boolean_environment_value,
    get_csv_environment_value,
    get_postgresql_database_settings,
    get_public_site_url,
)

DEBUG = get_boolean_environment_value("DJANGO_DEBUG", default=True)
ALLOWED_HOSTS = get_csv_environment_value(
    "DJANGO_ALLOWED_HOSTS", default=("localhost", "127.0.0.1")
)

DATABASES = {"default": get_postgresql_database_settings()}

# Reserved .test origin makes locally generated QR codes deterministic and safe.
PUBLIC_SITE_URL = get_public_site_url("PUBLIC_SITE_URL", default="https://elcruce.test")
