"""Production settings with explicit hosts and secure cookie configuration."""

import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403 - Environment modules intentionally inherit base settings.
from .base import (
    get_csv_environment_value,
    get_cookie_domain,
    get_database_url_settings,
    get_https_origins,
    get_postgresql_database_settings,
    get_public_site_url,
)

DEBUG = False
ALLOWED_HOSTS = get_csv_environment_value("DJANGO_ALLOWED_HOSTS")
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured(
        "The DJANGO_ALLOWED_HOSTS environment variable must be set."
    )

DATABASES = {
    "default": (
        get_database_url_settings()
        if "DATABASE_URL" in os.environ
        else get_postgresql_database_settings()
    )
}

# Permanent QR codes must resolve independently of the API host that renders them.
PUBLIC_SITE_URL = get_public_site_url("PUBLIC_SITE_URL")

CORS_ALLOWED_ORIGINS = get_https_origins("DJANGO_CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True
CORS_URLS_REGEX = r"^/api/.*$"
CSRF_TRUSTED_ORIGINS = get_https_origins("DJANGO_CSRF_TRUSTED_ORIGINS")

CSRF_COOKIE_SECURE = True
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = "Lax"
JWT_REFRESH_COOKIE_SECURE = True
JWT_REFRESH_COOKIE_SAMESITE = "Lax"
DJANGO_COOKIE_DOMAIN = get_cookie_domain("DJANGO_COOKIE_DOMAIN")
CSRF_COOKIE_DOMAIN = DJANGO_COOKIE_DOMAIN
SESSION_COOKIE_DOMAIN = DJANGO_COOKIE_DOMAIN
JWT_REFRESH_COOKIE_DOMAIN = DJANGO_COOKIE_DOMAIN
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31_536_000
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
X_FRAME_OPTIONS = "DENY"
