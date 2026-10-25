"""Authentication and current-user HTTP endpoints."""

from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .cookies import clear_refresh_cookie, set_refresh_cookie
from .permissions import IsInternalUser
from .serializers import CurrentUserSerializer


def get_refresh_token_from_cookie(request) -> str:
    """Return the browser refresh token or a consistent validation error."""
    refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
    if not refresh_token:
        raise ValidationError({"refresh": ["Refresh token cookie is required."]})
    return refresh_token


@method_decorator(ensure_csrf_cookie, name="dispatch")
class LoginView(APIView):
    """Authenticate an internal user and issue browser-safe JWT credentials."""

    authentication_classes = [JWTAuthentication]
    permission_classes = [AllowAny]

    def post(self, request) -> Response:
        serializer = TokenObtainPairSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        response = Response({"access": serializer.validated_data["access"]})
        set_refresh_cookie(response, serializer.validated_data["refresh"])
        return response


@method_decorator(csrf_protect, name="dispatch")
class RefreshView(APIView):
    """Rotate the refresh cookie and return a replacement access token."""

    authentication_classes = [JWTAuthentication]
    permission_classes = [AllowAny]

    def post(self, request) -> Response:
        serializer = TokenRefreshSerializer(
            data={"refresh": get_refresh_token_from_cookie(request)}
        )
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as error:
            raise InvalidToken(error.args[0]) from error

        response = Response({"access": serializer.validated_data["access"]})
        set_refresh_cookie(response, serializer.validated_data["refresh"])
        return response


@method_decorator(csrf_protect, name="dispatch")
class LogoutView(APIView):
    """Revoke the refresh cookie when possible and always clear it."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request) -> Response:
        refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                pass

        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_refresh_cookie(response)
        return response


class CurrentUserView(APIView):
    """Return the authenticated internal user's server-authoritative role."""

    permission_classes = [IsInternalUser]

    def get(self, request) -> Response:
        return Response(CurrentUserSerializer(request.user).data)
