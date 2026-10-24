"""Shared Django settings and environment parsing helpers."""

import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured


BASE_DIR = Path(__file__).resolve().parent.parent.parent


PLACEHOLDER_VALUES = frozenset(
    {
        "changeme",
        "change-me",
        "change_me",
        "default",
        "dummy",
        "example",
        "none",
        "null",
        "password",
        "placeholder",
        "replace-me",
        "replace_me",
        "todo",
        "unset",
        "your-value",
        "your_value",
    }
)


def is_obvious_placeholder(value: str) -> bool:
    """Return whether a value is clearly a sample value rather than configuration."""
    normalized_value = value.strip().casefold()
    return (
        normalized_value in PLACEHOLDER_VALUES
        or normalized_value.startswith("replace-with-")
        or normalized_value.startswith("your-")
        or normalized_value.startswith("example-")
        or (normalized_value.startswith("<") and normalized_value.endswith(">"))
    )


def get_environment_value(
    name: str,
    *,
    default: str | None = None,
    reject_placeholder: bool = False,
) -> str:
    """Return a required environment value after explicit safety validation."""
    value = os.environ.get(name, default)
    if value is None or not value.strip():
        message = f"The {name} environment variable must be set."
        raise ImproperlyConfigured(message)
    if reject_placeholder and is_obvious_placeholder(value):
        message = f"The {name} environment variable must not use a placeholder value."
        raise ImproperlyConfigured(message)
    return value


def get_boolean_environment_value(name: str, *, default: bool) -> bool:
    """Parse a boolean environment value without accepting ambiguous input."""
    value = os.environ.get(name)
    if value is None:
        return default

    normalized_value = value.strip().lower()
    if normalized_value in {"1", "true", "yes", "on"}:
        return True
    if normalized_value in {"0", "false", "no", "off"}:
        return False

    message = f"The {name} environment variable must be a boolean value."
    raise ImproperlyConfigured(message)


def get_csv_environment_value(name: str, *, default: tuple[str, ...] = ()) -> list[str]:
    """Parse a comma-separated environment value, ignoring blank entries."""
    value = os.environ.get(name)
    if value is None:
        return list(default)
    return [item.strip() for item in value.split(",") if item.strip()]


def get_postgresql_database_settings() -> dict[str, str | int]:
    """Build the required PostgreSQL connection configuration from POSTGRES_* values."""
    port_value = get_environment_value("POSTGRES_PORT", reject_placeholder=True)
    try:
        port = int(port_value)
    except ValueError as error:
        message = "The POSTGRES_PORT environment variable must be an integer from 1 to 65535."
        raise ImproperlyConfigured(message) from error

    if not 1 <= port <= 65535:
        message = "The POSTGRES_PORT environment variable must be an integer from 1 to 65535."
        raise ImproperlyConfigured(message)

    return {
        "ENGINE": "django.db.backends.postgresql",
        "HOST": get_environment_value("POSTGRES_HOST", reject_placeholder=True),
        "PORT": port,
        "NAME": get_environment_value("POSTGRES_DB", reject_placeholder=True),
        "USER": get_environment_value("POSTGRES_USER", reject_placeholder=True),
        "PASSWORD": get_environment_value("POSTGRES_PASSWORD", reject_placeholder=True),
    }


def get_postgresql_test_database_name(database_name: str) -> str:
    """Derive a PostgreSQL-safe test database name distinct from the application DB."""
    test_database_name = f"test_{database_name}"
    if len(test_database_name.encode()) > 63:
        message = (
            "POSTGRES_DB is too long to derive the required PostgreSQL test database "
            "name test_<POSTGRES_DB> (maximum 58 UTF-8 bytes)."
        )
        raise ImproperlyConfigured(message)
    return test_database_name


SECRET_KEY = get_environment_value("DJANGO_SECRET_KEY", reject_placeholder=True)

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

LANGUAGE_CODE = "es-es"
TIME_ZONE = "Europe/Madrid"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
