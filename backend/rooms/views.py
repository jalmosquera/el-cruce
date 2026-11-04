"""Administrative HTTP endpoints for room management."""

from django.db import transaction
from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.exceptions import ErrorDetail, ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from reservations.services import get_largest_occupying_guest_count

from .models import Room
from .permissions import IsRoomAdministratorOrManager
from .serializers import RoomSerializer


class RoomViewSet(ModelViewSet):
    """Provide administrative CRUD operations for internally managed rooms."""

    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [IsRoomAdministratorOrManager]

    def update(self, request, *args, **kwargs):
        """Serialize capacity changes with reservation creation on the room row."""
        with transaction.atomic():
            return super().update(request, *args, **kwargs)

    def perform_update(self, serializer: RoomSerializer) -> None:
        """Recheck a capacity change after locking the room row.

        The serializer runs before this request holds any lock, so a concurrent
        reservation may have been committed after its capacity check. Locking
        the room row serializes this update with reservation creation, which
        locks the same room before validating capacity and inserting the row.
        """
        if "capacity" not in serializer.validated_data:
            serializer.save()
            return

        room = Room.objects.select_for_update().get(pk=serializer.instance.pk)
        serializer.instance = room
        capacity = serializer.validated_data["capacity"]
        largest_occupying_guest_count = get_largest_occupying_guest_count(room)
        if (
            largest_occupying_guest_count is not None
            and capacity < largest_occupying_guest_count
        ):
            raise ValidationError(
                {
                    "capacity": [
                        ErrorDetail(
                            "Capacity cannot be lower than the guest count of an occupying reservation.",
                            code="capacity_below_occupying_guest_count",
                        )
                    ]
                }
            )
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        """Reject deletion with a controlled conflict when reservations reference it."""
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    "detail": ErrorDetail(
                        "This room cannot be deleted because a reservation references it.",
                        code="room_in_use",
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
