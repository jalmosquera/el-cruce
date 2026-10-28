"""Production settings with explicit hosts and secure cookie configuration."""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403 - Environment modules intentionally inherit base settings.
from .base import get_csv_environment_value, get_postgresql_database_settings

DEBUG = False
ALLOWED_HOSTS = get_csv_environment_value("DJANGO_ALLOWED_HOSTS")
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured(
        "The DJANGO_ALLOWED_HOSTS environment variable must be set."
    )

DATABASES = {"default": get_postgresql_database_settings()}

CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
JWT_REFRESH_COOKIE_SECURE = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
