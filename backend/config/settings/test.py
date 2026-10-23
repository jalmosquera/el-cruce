"""Isolated test settings that do not require an external database service."""

from .base import *  # noqa: F403 - Environment modules intentionally inherit base settings.
from .base import get_csv_environment_value


DEBUG = False
ALLOWED_HOSTS = get_csv_environment_value("DJANGO_ALLOWED_HOSTS", default=("testserver",))

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}
