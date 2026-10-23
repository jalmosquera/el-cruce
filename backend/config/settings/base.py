"""Shared Django settings and environment parsing helpers."""

import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured


BASE_DIR = Path(__file__).resolve().parent.parent.parent


def get_environment_value(name: str, *, default: str | None = None) -> str:
    """Return a required environment value, or an explicit safe default."""
    value = os.environ.get(name, default)
    if value is None or not value.strip():
        message = f"The {name} environment variable must be set."
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


SECRET_KEY = get_environment_value("DJANGO_SECRET_KEY")

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
