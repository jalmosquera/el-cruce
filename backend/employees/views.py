"""DRF endpoints for employee profiles and shift scheduling."""

from django.db import IntegrityError, transaction
from rest_framework import status, viewsets
from rest_framework.response import Response

from .models import Employee, Shift
from .permissions import IsManagerOrAdministrator
from .serializers import EmployeeSerializer, ShiftSerializer


class ShiftIntegrityErrorHandlingMixin:
    """Translate the database overlap invariant into a stable API validation response."""

    overlap_constraint_name = "employees_shift_no_overlapping_assignments"

    def create(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                return super().create(request, *args, **kwargs)
        except IntegrityError as error:
            return self._handle_shift_integrity_error(error)

    def update(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                return super().update(request, *args, **kwargs)
        except IntegrityError as error:
            return self._handle_shift_integrity_error(error)

    def _handle_shift_integrity_error(self, error: IntegrityError) -> Response:
        diagnostic = getattr(getattr(error, "__cause__", None), "diag", None)
        if getattr(diagnostic, "constraint_name", None) == self.overlap_constraint_name:
            return Response(
                {"non_field_errors": ["This employee already has an overlapping shift."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        raise error


class EmployeeViewSet(viewsets.ModelViewSet):
    """Manage minimal employee profiles for internal users."""

    queryset = Employee.objects.select_related("user").order_by("pk")
    serializer_class = EmployeeSerializer
    permission_classes = [IsManagerOrAdministrator]


class ShiftViewSet(ShiftIntegrityErrorHandlingMixin, viewsets.ModelViewSet):
    """Manage employee shift assignments with database-backed conflict prevention."""

    queryset = Shift.objects.select_related("employee", "employee__user").order_by("starts_at", "pk")
    serializer_class = ShiftSerializer
    permission_classes = [IsManagerOrAdministrator]
