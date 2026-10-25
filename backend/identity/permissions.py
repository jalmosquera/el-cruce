"""Permissions shared by identity HTTP endpoints."""

from rest_framework.permissions import BasePermission

from .models import UserRole


class IsInternalUser(BasePermission):
    """Allow only authenticated users with an approved internal role."""

    message = "An authenticated internal user is required."

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in UserRole.values
        )
