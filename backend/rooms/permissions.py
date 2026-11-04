"""Authorization rules for internal room management."""

from rest_framework.permissions import BasePermission

from identity.models import UserRole


class IsRoomAdministratorOrManager(BasePermission):
    """Allow room administration only to administrators and managers."""

    message = "Administrator or manager role required."

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in {UserRole.ADMINISTRATOR, UserRole.MANAGER}
        )
