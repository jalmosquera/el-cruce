"""Meaningful tests for backend configuration and isolated PostgreSQL settings."""

import importlib
import os

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

    from config.settings import development

    importlib.reload(development)

    assert development.DEBUG is True
    assert development.ALLOWED_HOSTS == ["localhost", "127.0.0.1"]


def test_production_settings_require_explicit_allowed_hosts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("DJANGO_ALLOWED_HOSTS", raising=False)

    with pytest.raises(ImproperlyConfigured, match="DJANGO_ALLOWED_HOSTS"):
        from config.settings import production

        importlib.reload(production)


def test_production_settings_enable_cookie_security(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DJANGO_ALLOWED_HOSTS", "elcruce.example")

    from config.settings import production

    importlib.reload(production)

    assert production.DEBUG is False
    assert production.ALLOWED_HOSTS == ["elcruce.example"]
    assert production.CSRF_COOKIE_SECURE is True
    assert production.SESSION_COOKIE_SECURE is True


def test_root_url_configuration_has_no_unapproved_domain_routes() -> None:
    from config.urls import urlpatterns

    assert urlpatterns == []
