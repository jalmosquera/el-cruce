"""Tests for Django's executable configuration entry points."""

import importlib
import os

import pytest


def test_wsgi_and_asgi_entrypoints_create_applications() -> None:
    import config.asgi
    import config.wsgi

    assert callable(config.asgi.application)
    assert callable(config.wsgi.application)


def test_manage_main_selects_settings_and_delegates_to_django(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import manage

    calls: list[list[str]] = []
    monkeypatch.delenv("DJANGO_SETTINGS_MODULE", raising=False)
    monkeypatch.setenv("EL_CRUCE_ENVIRONMENT", "test")
    monkeypatch.setattr(
        "django.core.management.execute_from_command_line",
        lambda arguments: calls.append(arguments),
    )

    importlib.reload(manage)
    manage.main()

    assert os.environ["DJANGO_SETTINGS_MODULE"] == "config.settings.test"
    assert calls
