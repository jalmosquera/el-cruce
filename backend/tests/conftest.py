"""Shared fixtures for isolated backend infrastructure tests."""

import os

TEST_ENVIRONMENT = {
    "EL_CRUCE_ENVIRONMENT": "test",
    "DJANGO_SECRET_KEY": "test-only-secret-key-not-for-production",
    "POSTGRES_HOST": "127.0.0.1",
    "POSTGRES_PORT": "55439",
    "POSTGRES_DB": "elcruce_infra05_source",
    "POSTGRES_USER": "elcruce_test",
    "POSTGRES_PASSWORD": "test-only-password",
}


for environment_name, environment_value in TEST_ENVIRONMENT.items():
    os.environ.setdefault(environment_name, environment_value)
