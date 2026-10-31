"""Refresh-token cookie helpers for browser authentication."""

from django.conf import settings
from django.http import HttpResponse


def set_refresh_cookie(response: HttpResponse, refresh_token: str) -> None:
    """Store a refresh token outside JavaScript access."""
    response.set_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=settings.JWT_REFRESH_COOKIE_MAX_AGE,
        httponly=True,
        secure=settings.JWT_REFRESH_COOKIE_SECURE,
        samesite=settings.JWT_REFRESH_COOKIE_SAMESITE,
        path=settings.JWT_REFRESH_COOKIE_PATH,
        domain=settings.JWT_REFRESH_COOKIE_DOMAIN,
    )


def clear_refresh_cookie(response: HttpResponse) -> None:
    """Expire the refresh-token cookie using its original scope and security flags."""
    response.delete_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        path=settings.JWT_REFRESH_COOKIE_PATH,
        samesite=settings.JWT_REFRESH_COOKIE_SAMESITE,
        domain=settings.JWT_REFRESH_COOKIE_DOMAIN,
    )
