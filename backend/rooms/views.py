"""Administrative HTTP endpoints for room management."""

from rest_framework.viewsets import ModelViewSet

from .models import Room
from .permissions import IsRoomAdministratorOrManager
from .serializers import RoomSerializer


class RoomViewSet(ModelViewSet):
    """Provide administrative CRUD operations for internally managed rooms."""

    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [IsRoomAdministratorOrManager]
