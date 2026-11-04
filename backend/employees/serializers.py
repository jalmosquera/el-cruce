"""HTTP serializers for employee profiles and shift scheduling."""

from datetime import datetime

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers

from identity.models import User

from .models import Employee, Shift


class TimezoneAwareDateTimeField(serializers.DateTimeField):
    """Require API clients to provide an explicit timezone offset."""

    default_error_messages = {
        "timezone": "A timezone offset is required.",
    }

    def to_internal_value(self, value):
        if isinstance(value, datetime):
            is_naive = timezone.is_naive(value)
        elif isinstance(value, str):
            parsed_value = parse_datetime(value)
            is_naive = parsed_value is not None and timezone.is_naive(parsed_value)
        else:
            is_naive = False

        if is_naive:
            raise serializers.ValidationError(self.error_messages["timezone"])
        return super().to_internal_value(value)


class EmployeeSerializer(serializers.ModelSerializer):
    """Expose only the internal user link for a minimal employee profile."""

    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())

    class Meta:
        model = Employee
        fields = ("id", "user")
        read_only_fields = ("id",)


class ShiftSerializer(serializers.ModelSerializer):
    """Validate shift intervals and present scheduling records."""

    starts_at = TimezoneAwareDateTimeField()
    ends_at = TimezoneAwareDateTimeField()

    class Meta:
        model = Shift
        fields = ("id", "employee", "starts_at", "ends_at")
        read_only_fields = ("id",)

    def validate(self, attributes):
        starts_at = attributes.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attributes.get("ends_at", getattr(self.instance, "ends_at", None))

        if starts_at and ends_at and ends_at <= starts_at:
            raise serializers.ValidationError(
                {"ends_at": "The shift must end after it starts."}
            )

        employee = attributes.get("employee", getattr(self.instance, "employee", None))
        if employee and starts_at and ends_at:
            overlapping_shifts = Shift.objects.filter(
                employee=employee,
                starts_at__lt=ends_at,
                ends_at__gt=starts_at,
            )
            if self.instance:
                overlapping_shifts = overlapping_shifts.exclude(pk=self.instance.pk)
            if overlapping_shifts.exists():
                raise serializers.ValidationError(
                    {"non_field_errors": "This employee already has an overlapping shift."}
                )

        return attributes
