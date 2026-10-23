#!/usr/bin/env python
"""Django management utility for El Cruce."""

import os
import sys

from config.settings.environment import get_settings_module


def main() -> None:
    """Run Django administrative commands using development settings by default."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", get_settings_module())

    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
