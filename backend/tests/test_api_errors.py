"""Tests for safe API exception behavior and stable DRF error responses."""

from rest_framework.exceptions import NotAuthenticated, ValidationError
from rest_framework.test import APIClient, APIRequestFactory

from config.api_errors import exception_handler


def test_unknown_api_route_returns_a_safe_json_404() -> None:
    response = APIClient().get("/api/does-not-exist/")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found."}


def test_unhandled_api_exception_does_not_expose_its_details() -> None:
    request = APIRequestFactory().get("/api/test-error/")

    response = exception_handler(
        RuntimeError("postgresql://user:password@internal.example/private"),
        {"request": request},
    )

    assert response.status_code == 500
    assert response.content == b'{"detail": "An unexpected server error occurred."}'


def test_drf_validation_error_contract_is_preserved() -> None:
    request = APIRequestFactory().post("/api/test-validation/", {})

    response = exception_handler(ValidationError({"name": ["Required."]}), {"request": request})

    assert response.status_code == 400
    assert response.data == {"name": ["Required."]}


def test_drf_authentication_error_contract_is_preserved() -> None:
    request = APIRequestFactory().get("/api/test-authentication/")

    response = exception_handler(NotAuthenticated(), {"request": request})

    assert response.status_code == 401
    assert response.data["detail"].code == "not_authenticated"
