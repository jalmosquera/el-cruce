"""Isolated PostgreSQL test settings."""

from .base import *  # noqa: F403 - Environment modules intentionally inherit base settings.
from .base import (
    get_csv_environment_value,
    get_postgresql_database_settings,
    get_postgresql_test_database_name,
)

DEBUG = False
ALLOWED_HOSTS = get_csv_environment_value(
    "DJANGO_ALLOWED_HOSTS", default=("testserver",)
)

DATABASES = {"default": get_postgresql_database_settings()}
DATABASES["default"]["TEST"] = {
    "NAME": get_postgresql_test_database_name(DATABASES["default"]["NAME"]),
}

# Tests must never rely on the request host or an unconfigured public domain.
PUBLIC_SITE_URL = "https://elcruce.test"
