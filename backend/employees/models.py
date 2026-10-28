"""Persistence models for employee profiles and operational shifts."""

from django.conf import settings
from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import DateTimeRangeField, RangeBoundary, RangeOperators
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Func, Q
from django.utils import timezone


class ShiftTimeRange(Func):
    """Build a PostgreSQL timestamp-with-time-zone range from shift boundaries."""

    function = "TSTZRANGE"
    output_field = DateTimeRangeField()


class Employee(models.Model):
    """Minimal operational profile for an internal user."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="employee_profile",
    )


class Shift(models.Model):
    """A scheduled interval assigned to one employee."""

    employee = models.ForeignKey(
        Employee,
        on_delete=models.PROTECT,
        related_name="shifts",
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(ends_at__gt=F("starts_at")),
                name="employees_shift_ends_after_start",
            ),
            ExclusionConstraint(
                name="employees_shift_no_overlapping_assignments",
                expressions=[
                    ("employee", RangeOperators.EQUAL),
                    (
                        ShiftTimeRange("starts_at", "ends_at", RangeBoundary()),
                        RangeOperators.OVERLAPS,
                    ),
                ],
                violation_error_code="overlapping_shift",
                violation_error_message="This employee already has an overlapping shift.",
            ),
        ]

    def clean(self) -> None:
        """Reject naive and invalid intervals before persistence when validation is used."""
        super().clean()
        errors = {}
        if self.starts_at and timezone.is_naive(self.starts_at):
            errors["starts_at"] = "A timezone-aware datetime is required."
        if self.ends_at and timezone.is_naive(self.ends_at):
            errors["ends_at"] = "A timezone-aware datetime is required."
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            errors["ends_at"] = "The shift must end after it starts."
        if errors:
            raise ValidationError(errors)
