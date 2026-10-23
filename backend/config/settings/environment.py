"""Select a settings module from the shared environment convention."""

import os

from django.core.exceptions import ImproperlyConfigured


SETTINGS_MODULES = {
    "development": "config.settings.development",
    "test": "config.settings.test",
    "production": "config.settings.production",
}


def get_settings_module() -> str:
    """Return the settings module selected by EL_CRUCE_ENVIRONMENT."""
    environment = os.environ.get("EL_CRUCE_ENVIRONMENT", "development")
    try:
        return SETTINGS_MODULES[environment]
    except KeyError as error:
        message = "EL_CRUCE_ENVIRONMENT must be development, test, or production."
        raise ImproperlyConfigured(message) from error
