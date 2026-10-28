"""Permissions for employee management endpoints."""

from rest_framework.permissions import BasePermission

from identity.models import UserRole


class IsManagerOrAdministrator(BasePermission):
    """Allow shift management only to authenticated managers and administrators."""

    message = "Manager or administrator access is required."

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in {UserRole.MANAGER, UserRole.ADMINISTRATOR}
        )
