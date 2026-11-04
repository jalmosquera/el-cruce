"""WSGI configuration for El Cruce."""

import os

from django.core.wsgi import get_wsgi_application

from config.settings.environment import get_settings_module

os.environ.setdefault("DJANGO_SETTINGS_MODULE", get_settings_module())

application = get_wsgi_application()
