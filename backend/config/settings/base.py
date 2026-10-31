"""Shared Django settings and environment parsing helpers."""

import os
import re
from datetime import timedelta
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

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


def get_https_origins(name: str) -> list[str]:
    """Return explicitly configured HTTPS origins, rejecting unsafe broad values."""
    origins = get_csv_environment_value(name)
    if not origins:
        message = f"The {name} environment variable must contain at least one HTTPS origin."
        raise ImproperlyConfigured(message)

    for origin in origins:
        parsed_origin = urlparse(origin)
        if (
            parsed_origin.scheme != "https"
            or not parsed_origin.hostname
            or parsed_origin.username
            or parsed_origin.password
            or parsed_origin.path not in {"", "/"}
            or parsed_origin.params
            or parsed_origin.query
            or parsed_origin.fragment
            or "*" in parsed_origin.hostname
        ):
            message = f"Each {name} value must be a specific HTTPS origin without a path."
            raise ImproperlyConfigured(message)
    return origins


def get_public_site_url(name: str, *, default: str | None = None) -> str:
    """Return one normalized HTTPS public origin for permanent QR payloads."""
    value = get_environment_value(name, default=default, reject_placeholder=True)
    parsed_url = urlparse(value)
    try:
        port = parsed_url.port
    except ValueError as error:
        raise ImproperlyConfigured(
            f"The {name} environment variable must contain a valid HTTPS origin."
        ) from error

    if (
        parsed_url.scheme != "https"
        or not parsed_url.hostname
        or parsed_url.username
        or parsed_url.password
        or parsed_url.path not in {"", "/"}
        or parsed_url.params
        or parsed_url.query
        or parsed_url.fragment
        or "*" in parsed_url.hostname
        or (port is not None and not 1 <= port <= 65535)
    ):
        raise ImproperlyConfigured(
            f"The {name} environment variable must be a specific HTTPS origin without "
            "credentials, a path, query, or fragment."
        )
    return f"https://{parsed_url.netloc}"


COOKIE_DOMAIN_PATTERN = re.compile(
    r"^\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$"
)


def get_cookie_domain(name: str) -> str | None:
    """Return an optional, shared, syntactically safe cookie domain."""
    value = os.environ.get(name)
    if value is None or not value.strip():
        return None

    domain = value.strip().lower()
    if not COOKIE_DOMAIN_PATTERN.fullmatch(domain):
        raise ImproperlyConfigured(
            f"The {name} environment variable must be a leading-dot registrable "
            "cookie domain without a scheme, port, path, or wildcard."
        )
    return domain


def get_database_url_settings() -> dict[str, object]:
    """Parse a PostgreSQL DATABASE_URL without logging credentials."""
    database_url = get_environment_value("DATABASE_URL", reject_placeholder=True)
    parsed_url = urlparse(database_url)
    if parsed_url.scheme not in {"postgres", "postgresql"}:
        raise ImproperlyConfigured("DATABASE_URL must use the postgresql scheme.")
    if not parsed_url.hostname or not parsed_url.path or parsed_url.path == "/":
        raise ImproperlyConfigured(
            "DATABASE_URL must include a PostgreSQL host and database name."
        )
    if parsed_url.username is None or parsed_url.password is None:
        raise ImproperlyConfigured(
            "DATABASE_URL must include PostgreSQL username and password."
        )
    try:
        port = parsed_url.port or 5432
    except ValueError as error:
        raise ImproperlyConfigured(
            "DATABASE_URL must contain a valid PostgreSQL port."
        ) from error
    if not 1 <= port <= 65535:
        raise ImproperlyConfigured("DATABASE_URL must contain a valid PostgreSQL port.")

    query = parse_qs(parsed_url.query, keep_blank_values=True)
    options = {
        name: values[-1]
        for name, values in query.items()
        if name in {"sslmode", "connect_timeout"} and values[-1]
    }
    database_settings: dict[str, object] = {
        "ENGINE": "django.db.backends.postgresql",
        "HOST": parsed_url.hostname,
        "PORT": port,
        "NAME": unquote(parsed_url.path.lstrip("/")),
        "USER": unquote(parsed_url.username),
        "PASSWORD": unquote(parsed_url.password),
    }
    if options:
        database_settings["OPTIONS"] = options
    return database_settings


def get_postgresql_database_settings() -> dict[str, str | int]:
    """Build the required PostgreSQL connection configuration from POSTGRES_* values."""
    port_value = get_environment_value("POSTGRES_PORT", reject_placeholder=True)
    try:
        port = int(port_value)
    except ValueError as error:
        message = (
            "The POSTGRES_PORT environment variable must be an integer from 1 to 65535."
        )
        raise ImproperlyConfigured(message) from error

    if not 1 <= port <= 65535:
        message = (
            "The POSTGRES_PORT environment variable must be an integer from 1 to 65535."
        )
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
JWT_SIGNING_KEY = get_environment_value("JWT_SIGNING_KEY", reject_placeholder=True)

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.postgres",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "employees",
    "identity",
    "guests",
    "rooms",
    "menu",
    "qr_codes",
    "reservations",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
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

AUTH_USER_MODEL = "identity.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}

SIMPLE_JWT = {
    "SIGNING_KEY": JWT_SIGNING_KEY,
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=5),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

JWT_REFRESH_COOKIE_NAME = "elcruce_refresh"
JWT_REFRESH_COOKIE_PATH = "/api/auth/"
JWT_REFRESH_COOKIE_DOMAIN = None
JWT_REFRESH_COOKIE_SAMESITE = "Lax"
JWT_REFRESH_COOKIE_SECURE = False
JWT_REFRESH_COOKIE_MAX_AGE = int(SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())
