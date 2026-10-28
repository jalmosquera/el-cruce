"""Authorization rules for menu management endpoints."""

from rest_framework.permissions import BasePermission

from identity.models import UserRole


class IsMenuManagerOrAdministrator(BasePermission):
    """Allow menu mutations and internal reads to managers and administrators only."""

    message = "A manager or administrator role is required."

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in {UserRole.ADMINISTRATOR, UserRole.MANAGER}
        )
