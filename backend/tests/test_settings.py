"""Meaningful tests for backend configuration and isolated PostgreSQL settings."""

import importlib
import os
import subprocess
import sys

import pytest
from django.core.exceptions import ImproperlyConfigured
from django.db import connection

from config.settings import base


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("replace-with-a-secret", True),
        (" your-value ", True),
        ("<value>", True),
        ("unique-secret", False),
    ],
)
def test_is_obvious_placeholder_identifies_only_sample_values(
    value: str, expected: bool
) -> None:
    assert base.is_obvious_placeholder(value) is expected


def test_get_environment_value_requires_a_non_blank_value(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("REQUIRED_VALUE", "   ")

    with pytest.raises(ImproperlyConfigured, match="REQUIRED_VALUE"):
        base.get_environment_value("REQUIRED_VALUE")


def test_get_environment_value_rejects_placeholder_when_requested(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("REQUIRED_VALUE", "change-me")

    with pytest.raises(ImproperlyConfigured, match="must not use a placeholder"):
        base.get_environment_value("REQUIRED_VALUE", reject_placeholder=True)


def test_get_environment_value_returns_a_safe_configured_value(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("REQUIRED_VALUE", "configured-value")

    assert (
        base.get_environment_value("REQUIRED_VALUE", reject_placeholder=True)
        == "configured-value"
    )


def test_settings_reject_missing_jwt_signing_key() -> None:
    environment = {
        "DJANGO_SECRET_KEY": "test-only-django-secret-with-at-least-fifty-characters-long",
        "PATH": os.environ["PATH"],
    }

    result = subprocess.run(
        [sys.executable, "-c", "import config.settings.base"],
        capture_output=True,
        check=False,
        cwd=base.BASE_DIR,
        env=environment,
        text=True,
    )

    assert result.returncode != 0
    assert "The JWT_SIGNING_KEY environment variable must be set." in result.stderr


def test_simple_jwt_uses_the_dedicated_jwt_signing_key() -> None:
    assert base.SIMPLE_JWT["SIGNING_KEY"] == os.environ["JWT_SIGNING_KEY"]
    assert base.SIMPLE_JWT["SIGNING_KEY"] != base.SECRET_KEY


@pytest.mark.parametrize(
    ("value", "expected"),
    [(None, True), ("true", True), ("ON", True), ("0", False), ("no", False)],
)
def test_get_boolean_environment_value_parses_explicit_values(
    monkeypatch: pytest.MonkeyPatch, value: str | None, expected: bool
) -> None:
    if value is None:
        monkeypatch.delenv("BOOLEAN_VALUE", raising=False)
    else:
        monkeypatch.setenv("BOOLEAN_VALUE", value)

    assert base.get_boolean_environment_value("BOOLEAN_VALUE", default=True) is expected


def test_get_boolean_environment_value_rejects_ambiguous_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("BOOLEAN_VALUE", "sometimes")

    with pytest.raises(ImproperlyConfigured, match="must be a boolean"):
        base.get_boolean_environment_value("BOOLEAN_VALUE", default=False)


@pytest.mark.parametrize(("value", "expected"), [(None, 0), ("0", 0), ("31536000", 31_536_000)])
def test_get_nonnegative_integer_environment_value_parses_safe_values(
    monkeypatch: pytest.MonkeyPatch, value: str | None, expected: int
) -> None:
    if value is None:
        monkeypatch.delenv("INTEGER_VALUE", raising=False)
    else:
        monkeypatch.setenv("INTEGER_VALUE", value)

    assert base.get_nonnegative_integer_environment_value("INTEGER_VALUE", default=0) == expected


@pytest.mark.parametrize("value", ["-1", "1.5", "invalid"])
def test_get_nonnegative_integer_environment_value_rejects_invalid_values(
    monkeypatch: pytest.MonkeyPatch, value: str
) -> None:
    monkeypatch.setenv("INTEGER_VALUE", value)

    with pytest.raises(ImproperlyConfigured, match="nonnegative integer"):
        base.get_nonnegative_integer_environment_value("INTEGER_VALUE", default=0)


def test_get_log_level_rejects_arbitrary_values(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DJANGO_LOG_LEVEL", "verbose")

    with pytest.raises(ImproperlyConfigured, match="standard logging level"):
        base.get_log_level("DJANGO_LOG_LEVEL")


def test_get_csv_environment_value_ignores_empty_entries(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("HOSTS", " localhost, ,example.test ,, ")

    assert base.get_csv_environment_value("HOSTS") == ["localhost", "example.test"]


def test_get_postgresql_database_settings_validates_the_port(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("POSTGRES_PORT", "70000")

    with pytest.raises(ImproperlyConfigured, match="integer from 1 to 65535"):
        base.get_postgresql_database_settings()


def test_get_postgresql_database_settings_rejects_a_non_numeric_port(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("POSTGRES_PORT", "not-a-port")

    with pytest.raises(ImproperlyConfigured, match="integer from 1 to 65535"):
        base.get_postgresql_database_settings()


def test_get_postgresql_database_settings_returns_validated_connection_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("POSTGRES_HOST", "127.0.0.1")
    monkeypatch.setenv("POSTGRES_PORT", "5432")
    monkeypatch.setenv("POSTGRES_DB", "elcruce")
    monkeypatch.setenv("POSTGRES_USER", "application")
    monkeypatch.setenv("POSTGRES_PASSWORD", "secure-password")

    assert base.get_postgresql_database_settings() == {
        "ENGINE": "django.db.backends.postgresql",
        "HOST": "127.0.0.1",
        "PORT": 5432,
        "NAME": "elcruce",
        "USER": "application",
        "PASSWORD": "secure-password",
    }


def test_get_database_url_settings_returns_validated_postgresql_connection_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://application:secure-password@db.example:5432/elcruce?sslmode=require",
    )

    assert base.get_database_url_settings() == {
        "ENGINE": "django.db.backends.postgresql",
        "HOST": "db.example",
        "PORT": 5432,
        "NAME": "elcruce",
        "USER": "application",
        "PASSWORD": "secure-password",
        "OPTIONS": {"sslmode": "require"},
    }


@pytest.mark.parametrize(
    "database_url",
    [
        "mysql://application:secure-password@db.example/elcruce",
        "postgresql://application@db.example/elcruce",
        "postgresql://application:secure-password@db.example/",
    ],
)
def test_get_database_url_settings_rejects_invalid_connection_urls(
    monkeypatch: pytest.MonkeyPatch, database_url: str
) -> None:
    monkeypatch.setenv("DATABASE_URL", database_url)

    with pytest.raises(ImproperlyConfigured, match="DATABASE_URL"):
        base.get_database_url_settings()


def test_get_https_origins_requires_specific_https_origins(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ORIGINS", "https://frontend.example,https://admin.example")

    assert base.get_https_origins("ORIGINS") == [
        "https://frontend.example",
        "https://admin.example",
    ]


@pytest.mark.parametrize(
    "origins",
    ["", "http://frontend.example", "https://*.example", "https://frontend.example/path"],
)
def test_get_https_origins_rejects_broad_or_non_origin_values(
    monkeypatch: pytest.MonkeyPatch, origins: str
) -> None:
    monkeypatch.setenv("ORIGINS", origins)

    with pytest.raises(ImproperlyConfigured, match="HTTPS origin"):
        base.get_https_origins("ORIGINS")


def test_get_public_site_url_normalizes_one_https_origin(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PUBLIC_SITE_URL", "https://public.example/")

    assert base.get_public_site_url("PUBLIC_SITE_URL") == "https://public.example"


@pytest.mark.parametrize(
    "public_site_url",
    [
        "",
        "http://public.example",
        "https://user:password@public.example",
        "https://public.example/carta",
        "https://public.example?campaign=qr",
        "https://public.example#menu",
        "https://public.example:invalid",
    ],
)
def test_get_public_site_url_rejects_non_origin_or_insecure_values(
    monkeypatch: pytest.MonkeyPatch, public_site_url: str
) -> None:
    monkeypatch.setenv("PUBLIC_SITE_URL", public_site_url)

    with pytest.raises(ImproperlyConfigured, match="PUBLIC_SITE_URL"):
        base.get_public_site_url("PUBLIC_SITE_URL")


def test_get_cookie_domain_returns_an_optional_shared_domain(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DJANGO_COOKIE_DOMAIN", ".approved.example")

    assert base.get_cookie_domain("DJANGO_COOKIE_DOMAIN") == ".approved.example"


@pytest.mark.parametrize(
    "cookie_domain",
    [
        "approved.example",
        "https://approved.example",
        ".api.approved.example/path",
        ".approved.example:443",
        ".approved.example/",
        ".*.approved.example",
        ".localhost",
        ".127.0.0.1",
    ],
)
def test_get_cookie_domain_rejects_unsafe_forms(
    monkeypatch: pytest.MonkeyPatch, cookie_domain: str
) -> None:
    monkeypatch.setenv("DJANGO_COOKIE_DOMAIN", cookie_domain)

    with pytest.raises(ImproperlyConfigured, match="cookie domain"):
        base.get_cookie_domain("DJANGO_COOKIE_DOMAIN")


def test_get_postgresql_test_database_name_is_distinct_from_application_database(
) -> None:
    assert base.get_postgresql_test_database_name("elcruce_infra05_source") == (
        "test_elcruce_infra05_source"
    )


def test_get_postgresql_test_database_name_rejects_names_that_exceed_postgresql_limit(
) -> None:
    with pytest.raises(ImproperlyConfigured, match="maximum 58 UTF-8 bytes"):
        base.get_postgresql_test_database_name("a" * 59)


def test_test_settings_use_a_different_postgresql_database_name() -> None:
    from config.settings import test

    database = test.DATABASES["default"]
    application_database_name = os.environ["POSTGRES_DB"]
    expected_test_database_name = base.get_postgresql_test_database_name(
        application_database_name
    )

    assert test.DEBUG is False
    assert test.PUBLIC_SITE_URL == "https://elcruce.test"
    assert database["ENGINE"] == "django.db.backends.postgresql"
    assert database["TEST"]["NAME"] == expected_test_database_name
    assert database["TEST"]["NAME"] != application_database_name


@pytest.mark.django_db
def test_django_uses_the_explicitly_isolated_postgresql_test_database() -> None:
    configured_database = connection.settings_dict
    application_database_name = os.environ["POSTGRES_DB"]
    expected_test_database_name = base.get_postgresql_test_database_name(
        application_database_name
    )

    assert connection.vendor == "postgresql"
    assert configured_database["NAME"] == expected_test_database_name
    assert configured_database["NAME"] != application_database_name


def test_development_settings_apply_the_development_defaults(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("DJANGO_DEBUG", raising=False)
    monkeypatch.delenv("DJANGO_ALLOWED_HOSTS", raising=False)
    monkeypatch.delenv("PUBLIC_SITE_URL", raising=False)

    from config.settings import development

    importlib.reload(development)

    assert development.DEBUG is True
    assert development.ALLOWED_HOSTS == ["localhost", "127.0.0.1"]
    assert development.PUBLIC_SITE_URL == "https://elcruce.test"


@pytest.fixture
def production_signing_secrets(monkeypatch: pytest.MonkeyPatch) -> None:
    with monkeypatch.context() as production_environment:
        production_environment.setenv(
            "DJANGO_SECRET_KEY",
            "production-test-django-signing-secret-that-is-long-and-distinct-01",
        )
        production_environment.setenv(
            "JWT_SIGNING_KEY",
            "production-test-jwt-signing-secret-that-is-long-and-distinct-02",
        )
        importlib.reload(base)
        yield

    importlib.reload(base)


def test_production_settings_require_explicit_allowed_hosts(
    monkeypatch: pytest.MonkeyPatch,
    production_signing_secrets: None,
) -> None:
    monkeypatch.delenv("DJANGO_ALLOWED_HOSTS", raising=False)

    with pytest.raises(ImproperlyConfigured, match="DJANGO_ALLOWED_HOSTS"):
        from config.settings import production

        importlib.reload(production)


def test_production_settings_enable_cookie_security(
    monkeypatch: pytest.MonkeyPatch,
    production_signing_secrets: None,
) -> None:
    monkeypatch.setenv("DJANGO_ALLOWED_HOSTS", "elcruce.example")
    monkeypatch.setenv("DJANGO_CORS_ALLOWED_ORIGINS", "https://app.approved.example")
    monkeypatch.setenv("DJANGO_CSRF_TRUSTED_ORIGINS", "https://app.approved.example")
    monkeypatch.setenv("DJANGO_COOKIE_DOMAIN", ".approved.example")
    monkeypatch.setenv("PUBLIC_SITE_URL", "https://public.approved.example")

    from config.settings import production

    importlib.reload(production)

    assert production.DEBUG is False
    assert production.ALLOWED_HOSTS == ["elcruce.example"]
    assert production.CSRF_COOKIE_SECURE is True
    assert production.SESSION_COOKIE_SECURE is True
    assert production.JWT_REFRESH_COOKIE_SECURE is True
    assert production.CORS_ALLOWED_ORIGINS == ["https://app.approved.example"]
    assert production.CORS_ALLOW_CREDENTIALS is True
    assert production.CSRF_TRUSTED_ORIGINS == ["https://app.approved.example"]
    assert production.CSRF_COOKIE_DOMAIN == ".approved.example"
    assert production.SESSION_COOKIE_DOMAIN == ".approved.example"
    assert production.JWT_REFRESH_COOKIE_DOMAIN == ".approved.example"
    assert production.CSRF_COOKIE_SAMESITE == "Lax"
    assert production.SESSION_COOKIE_SAMESITE == "Lax"
    assert production.JWT_REFRESH_COOKIE_SAMESITE == "Lax"
    assert production.SECURE_PROXY_SSL_HEADER == ("HTTP_X_FORWARDED_PROTO", "https")
    assert production.SECURE_HSTS_SECONDS == 0
    assert production.SECURE_HSTS_INCLUDE_SUBDOMAINS is False
    assert production.SECURE_HSTS_PRELOAD is False
    assert production.REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] == (
        "rest_framework.renderers.JSONRenderer",
    )


def test_production_settings_configure_valid_hsts_after_domain_approval(
    monkeypatch: pytest.MonkeyPatch,
    production_signing_secrets: None,
) -> None:
    monkeypatch.setenv("DJANGO_ALLOWED_HOSTS", "api.approved.example")
    monkeypatch.setenv("DJANGO_CORS_ALLOWED_ORIGINS", "https://app.approved.example")
    monkeypatch.setenv("DJANGO_CSRF_TRUSTED_ORIGINS", "https://app.approved.example")
    monkeypatch.setenv("PUBLIC_SITE_URL", "https://public.approved.example")
    monkeypatch.setenv("DJANGO_HSTS_SECONDS", "31536000")
    monkeypatch.setenv("DJANGO_HSTS_INCLUDE_SUBDOMAINS", "true")
    monkeypatch.setenv("DJANGO_HSTS_PRELOAD", "true")

    from config.settings import production

    importlib.reload(production)

    assert production.SECURE_HSTS_SECONDS == 31_536_000
    assert production.SECURE_HSTS_INCLUDE_SUBDOMAINS is True
    assert production.SECURE_HSTS_PRELOAD is True


def test_production_settings_reject_preload_without_its_browser_requirements(
    monkeypatch: pytest.MonkeyPatch,
    production_signing_secrets: None,
) -> None:
    monkeypatch.setenv("DJANGO_ALLOWED_HOSTS", "api.approved.example")
    monkeypatch.setenv("DJANGO_CORS_ALLOWED_ORIGINS", "https://app.approved.example")
    monkeypatch.setenv("DJANGO_CSRF_TRUSTED_ORIGINS", "https://app.approved.example")
    monkeypatch.setenv("PUBLIC_SITE_URL", "https://public.approved.example")
    monkeypatch.setenv("DJANGO_HSTS_SECONDS", "0")
    monkeypatch.setenv("DJANGO_HSTS_INCLUDE_SUBDOMAINS", "false")
    monkeypatch.setenv("DJANGO_HSTS_PRELOAD", "true")

    from config.settings import production

    with pytest.raises(ImproperlyConfigured, match="requires include subdomains"):
        importlib.reload(production)


def test_production_settings_reject_reused_or_short_signing_secrets(
) -> None:
    with pytest.raises(ImproperlyConfigured, match="must be distinct"):
        base.validate_production_secrets("same-secret", "same-secret")

    with pytest.raises(ImproperlyConfigured, match="at least 50 characters"):
        base.validate_production_secrets("short-secret", "a-different-secret")


def test_production_settings_fail_closed_when_public_site_url_is_missing() -> None:
    environment = {
        "DJANGO_SECRET_KEY": "test-only-django-secret-with-at-least-fifty-characters-long",
        "JWT_SIGNING_KEY": "test-only-jwt-secret-with-at-least-fifty-characters-long-too",
        "DATABASE_URL": "postgresql://application:secure-password@db.example/elcruce",
        "DJANGO_ALLOWED_HOSTS": "api.approved.example",
        "DJANGO_CORS_ALLOWED_ORIGINS": "https://app.approved.example",
        "DJANGO_CSRF_TRUSTED_ORIGINS": "https://app.approved.example",
        "PATH": os.environ["PATH"],
    }

    result = subprocess.run(
        [sys.executable, "-c", "import config.settings.production"],
        capture_output=True,
        check=False,
        cwd=base.BASE_DIR,
        env=environment,
        text=True,
    )

    assert result.returncode != 0
    assert "The PUBLIC_SITE_URL environment variable must be set." in result.stderr


def test_root_url_configuration_registers_approved_domain_routes() -> None:
    from config.urls import urlpatterns

    assert [str(pattern.pattern) for pattern in urlpatterns] == [
        "healthz/",
        "api/auth/",
        "api/identity/",
        "api/guests/",
        "api/rooms/",
        "api/menu/",
        "api/qr-codes/",
        "api/reservations/",
        "api/",
        "q/",
    ]
