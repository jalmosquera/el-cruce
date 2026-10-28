"""Administrative HTTP endpoints for guest management."""

from rest_framework.viewsets import ModelViewSet

from .models import Guest
from .permissions import IsGuestAdministratorOrManager
from .serializers import GuestSerializer


class GuestViewSet(ModelViewSet):
    """Provide administrative CRUD operations for internal guest records."""

    queryset = Guest.objects.all()
    serializer_class = GuestSerializer
    permission_classes = [IsGuestAdministratorOrManager]
