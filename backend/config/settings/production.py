"""Production settings with explicit hosts and secure cookie configuration."""

from .base import *  # noqa: F403 - Environment modules intentionally inherit base settings.
from .base import get_csv_environment_value


DEBUG = False
ALLOWED_HOSTS = get_csv_environment_value("DJANGO_ALLOWED_HOSTS")
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured("The DJANGO_ALLOWED_HOSTS environment variable must be set.")

# PostgreSQL wiring, including its database driver and connection settings, belongs
# to INFRA-03. Keep the bootstrap explicitly non-operational for database access
# rather than accidentally loading an unavailable PostgreSQL backend.
DATABASES = {"default": {"ENGINE": "django.db.backends.dummy"}}

CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
