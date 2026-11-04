"""Administrative HTTP endpoints for guest management."""

from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.exceptions import ErrorDetail
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .models import Guest
from .permissions import IsGuestAdministratorOrManager
from .serializers import GuestSerializer


class GuestViewSet(ModelViewSet):
    """Provide administrative CRUD operations for internal guest records."""

    queryset = Guest.objects.all()
    serializer_class = GuestSerializer
    permission_classes = [IsGuestAdministratorOrManager]

    def destroy(self, request, *args, **kwargs):
        """Reject deletion with a controlled conflict when reservations reference it."""
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    "detail": ErrorDetail(
                        "This guest cannot be deleted because a reservation references it.",
                        code="guest_in_use",
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
