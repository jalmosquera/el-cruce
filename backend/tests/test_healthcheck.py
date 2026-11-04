"""Tests for the deployment liveness endpoint."""

from django.test import Client


def test_healthcheck_is_public_and_contains_no_operational_details() -> None:
    response = Client().get("/healthz/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
