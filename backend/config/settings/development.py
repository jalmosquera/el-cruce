"""Local development settings using the isolated SQLite bootstrap database."""

from .base import *  # noqa: F403 - Environment modules intentionally inherit base settings.
from .base import BASE_DIR, get_boolean_environment_value, get_csv_environment_value


DEBUG = get_boolean_environment_value("DJANGO_DEBUG", default=True)
ALLOWED_HOSTS = get_csv_environment_value(
    "DJANGO_ALLOWED_HOSTS", default=("localhost", "127.0.0.1")
)

# PostgreSQL is intentionally deferred to INFRA-03. This local fallback keeps
# Django configuration checks independent from external services.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}
