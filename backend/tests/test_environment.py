"""Tests for explicit Django environment selection."""

import pytest
from django.core.exceptions import ImproperlyConfigured

from config.settings.environment import get_settings_module


@pytest.mark.parametrize(
    ("environment", "expected_module"),
    [
        ("development", "config.settings.development"),
        ("test", "config.settings.test"),
        ("production", "config.settings.production"),
    ],
)
def test_get_settings_module_returns_the_module_for_a_supported_environment(
    monkeypatch: pytest.MonkeyPatch, environment: str, expected_module: str
) -> None:
    monkeypatch.setenv("EL_CRUCE_ENVIRONMENT", environment)

    assert get_settings_module() == expected_module


def test_get_settings_module_defaults_to_development(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("EL_CRUCE_ENVIRONMENT", raising=False)

    assert get_settings_module() == "config.settings.development"


def test_get_settings_module_rejects_an_unsupported_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EL_CRUCE_ENVIRONMENT", "staging")

    with pytest.raises(ImproperlyConfigured, match="development, test, or production"):
        get_settings_module()
