"""PostgreSQL-backed integration tests for browser JWT authentication."""

from datetime import timedelta

import pytest
from django.conf import settings
from django.db import IntegrityError, transaction
from rest_framework.test import APIClient
from rest_framework_simplejwt.backends import TokenBackend
from rest_framework_simplejwt.exceptions import TokenBackendError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from identity.models import User, UserRole

pytestmark = pytest.mark.django_db

LOGIN_URL = "/api/auth/login/"
REFRESH_URL = "/api/auth/refresh/"
LOGOUT_URL = "/api/auth/logout/"
CURRENT_USER_URL = "/api/auth/me/"
PASSWORD = "correct-horse-battery-staple"


@pytest.fixture
def user() -> User:
    return User.objects.create_user(
        username="manager",
        password=PASSWORD,
        role=UserRole.MANAGER,
    )


def login(client: APIClient, username: str = "manager"):
    return client.post(LOGIN_URL, {"username": username, "password": PASSWORD}, format="json")


def csrf_headers(response) -> dict[str, str]:
    return {"HTTP_X_CSRFTOKEN": response.cookies["csrftoken"].value}


def expired_access_token(user: User) -> str:
    token = AccessToken.for_user(user)
    token.set_exp(lifetime=timedelta(minutes=-1))
    return str(token)


def with_expired_bearer_token(client: APIClient, user: User) -> APIClient:
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {expired_access_token(user)}")
    return client


def test_user_role_database_constraint_rejects_unknown_roles(user: User) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        User.objects.filter(pk=user.pk).update(role="unknown")


def test_login_returns_only_access_token_and_sets_httponly_refresh_cookie(
    user: User,
) -> None:
    response = login(APIClient())

    assert response.status_code == 200
    assert set(response.data) == {"access"}
    assert AccessToken(response.data["access"])["user_id"] == str(user.pk)

    refresh_cookie = response.cookies["elcruce_refresh"]
    assert refresh_cookie.value
    assert refresh_cookie["httponly"] is True
    assert refresh_cookie["samesite"] == "Lax"
    assert refresh_cookie["path"] == "/api/auth/"
    assert not refresh_cookie["secure"]


def test_login_access_token_is_not_signed_with_django_secret_key(user: User) -> None:
    response = login(APIClient())

    with pytest.raises(TokenBackendError):
        TokenBackend(
            algorithm=api_settings.ALGORITHM,
            signing_key=settings.SECRET_KEY,
        ).decode(response.data["access"], verify=True)


def test_login_rejects_invalid_credentials_without_setting_a_refresh_cookie() -> None:
    response = login(APIClient(), username="unknown")

    assert response.status_code == 401
    assert response.data == {"detail": "No active account found with the given credentials"}
    assert "elcruce_refresh" not in response.cookies


def test_login_ignores_an_expired_bearer_header(user: User) -> None:
    client = with_expired_bearer_token(APIClient(), user)

    response = login(client)

    assert response.status_code == 200
    assert set(response.data) == {"access"}
    assert AccessToken(response.data["access"])["user_id"] == str(user.pk)
    assert response.cookies["elcruce_refresh"].value


def test_login_still_rejects_invalid_credentials_with_an_expired_bearer_header(
    user: User,
) -> None:
    client = with_expired_bearer_token(APIClient(), user)

    response = login(client, username="unknown")

    assert response.status_code == 401
    assert response.data == {"detail": "No active account found with the given credentials"}
    assert "elcruce_refresh" not in response.cookies


def test_refresh_requires_a_csrf_token_for_the_cookie_authenticated_request(
    user: User,
) -> None:
    client = APIClient(enforce_csrf_checks=True)
    login(client)

    response = client.post(REFRESH_URL, format="json")

    assert response.status_code == 403


def test_refresh_rotates_cookie_and_blacklists_the_submitted_token(user: User) -> None:
    client = APIClient(enforce_csrf_checks=True)
    login_response = login(client)
    old_refresh = login_response.cookies["elcruce_refresh"].value
    old_jti = RefreshToken(old_refresh)["jti"]

    response = client.post(REFRESH_URL, format="json", **csrf_headers(login_response))

    assert response.status_code == 200
    assert set(response.data) == {"access"}
    assert response.cookies["elcruce_refresh"].value != old_refresh
    assert BlacklistedToken.objects.filter(token__jti=old_jti).exists()

    replay_client = APIClient(enforce_csrf_checks=True)
    replay_client.cookies["elcruce_refresh"] = old_refresh
    replay_client.cookies["csrftoken"] = login_response.cookies["csrftoken"].value
    replay_response = replay_client.post(
        REFRESH_URL, format="json", **csrf_headers(login_response)
    )
    assert replay_response.status_code == 401


def test_refresh_ignores_an_expired_bearer_header_and_rotates_cookie(
    user: User,
) -> None:
    client = APIClient(enforce_csrf_checks=True)
    login_response = login(client)
    old_refresh = login_response.cookies["elcruce_refresh"].value
    old_jti = RefreshToken(old_refresh)["jti"]
    with_expired_bearer_token(client, user)

    response = client.post(REFRESH_URL, format="json", **csrf_headers(login_response))

    assert response.status_code == 200
    assert set(response.data) == {"access"}
    assert response.cookies["elcruce_refresh"].value != old_refresh
    assert BlacklistedToken.objects.filter(token__jti=old_jti).exists()


def test_refresh_still_rejects_an_invalid_cookie_with_an_expired_bearer_header(
    user: User,
) -> None:
    client = APIClient(enforce_csrf_checks=True)
    login_response = login(client)
    with_expired_bearer_token(client, user)
    client.cookies["elcruce_refresh"] = "not-a-jwt"

    response = client.post(REFRESH_URL, format="json", **csrf_headers(login_response))

    assert response.status_code == 401
    assert response.data["code"] == "token_not_valid"
    assert "elcruce_refresh" not in response.cookies


def test_refresh_still_requires_a_cookie_with_an_expired_bearer_header(
    user: User,
) -> None:
    client = APIClient(enforce_csrf_checks=True)
    login_response = login(client)
    with_expired_bearer_token(client, user)
    client.cookies.pop("elcruce_refresh")

    response = client.post(REFRESH_URL, format="json", **csrf_headers(login_response))

    assert response.status_code == 400
    assert response.data == {"refresh": ["Refresh token cookie is required."]}


def test_refresh_still_requires_csrf_with_an_expired_bearer_header(user: User) -> None:
    client = APIClient(enforce_csrf_checks=True)
    login(client)
    with_expired_bearer_token(client, user)

    response = client.post(REFRESH_URL, format="json")

    assert response.status_code == 403


def test_logout_requires_csrf_and_revokes_then_clears_refresh_cookie(user: User) -> None:
    client = APIClient(enforce_csrf_checks=True)
    login_response = login(client)
    refresh_token = login_response.cookies["elcruce_refresh"].value
    refresh_jti = RefreshToken(refresh_token)["jti"]

    forbidden_response = client.post(LOGOUT_URL, format="json")
    assert forbidden_response.status_code == 403

    response = client.post(LOGOUT_URL, format="json", **csrf_headers(login_response))
    assert response.status_code == 204
    assert BlacklistedToken.objects.filter(token__jti=refresh_jti).exists()
    assert response.cookies["elcruce_refresh"]["max-age"] == 0

    replay_client = APIClient(enforce_csrf_checks=True)
    replay_client.cookies["elcruce_refresh"] = refresh_token
    replay_client.cookies["csrftoken"] = login_response.cookies["csrftoken"].value
    replay_response = replay_client.post(
        REFRESH_URL, format="json", **csrf_headers(login_response)
    )
    assert replay_response.status_code == 401


def test_current_user_requires_an_access_token() -> None:
    response = APIClient().get(CURRENT_USER_URL)

    assert response.status_code == 401
    assert response.data == {
        "detail": "Las credenciales de autenticación no se proveyeron."
    }


@pytest.mark.parametrize("role", UserRole.values)
def test_current_user_uses_the_server_authoritative_role(
    role: str,
) -> None:
    user = User.objects.create_user(username=role, password=PASSWORD, role=role)
    login_response = login(APIClient(), username=role)

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")
    response = client.get(CURRENT_USER_URL)

    assert response.status_code == 200
    assert response.data == {"id": user.pk, "username": role, "role": role}
