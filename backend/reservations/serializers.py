"""HTTP serializers for the reservations domain."""

from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail

from guests.models import Guest
from rooms.models import Room

from .models import (
    ALLOWED_STATUS_TRANSITIONS,
    INTERNAL_NOTES_MAX_LENGTH,
    Reservation,
    ReservationStatus,
)


class AvailabilityQuerySerializer(serializers.Serializer):
    """Validate the requested stay range used to search available rooms."""

    check_in = serializers.DateField()
    check_out = serializers.DateField()
    room = serializers.IntegerField(min_value=1, required=False)

    def validate(self, attributes: dict[str, object]) -> dict[str, object]:
        if attributes["check_out"] <= attributes["check_in"]:
            raise serializers.ValidationError(
                {
                    "check_out": ErrorDetail(
                        "Check-out must be later than check-in.",
                        code="check_out_not_after_check_in",
                    )
                }
            )
        return attributes


class ReservationSerializer(serializers.ModelSerializer):
    """Validate and represent an internal reservation."""

    room = serializers.PrimaryKeyRelatedField(queryset=Room.objects.all())
    guest = serializers.PrimaryKeyRelatedField(queryset=Guest.objects.all())
    check_in = serializers.DateField()
    check_out = serializers.DateField()
    guest_count = serializers.IntegerField(
        min_value=1,
        error_messages={"min_value": "Guest count must be greater than zero."},
    )
    status = serializers.ChoiceField(
        choices=ReservationStatus.choices,
        required=False,
    )
    internal_notes = serializers.CharField(
        allow_blank=True,
        max_length=INTERNAL_NOTES_MAX_LENGTH,
        required=False,
    )

    class Meta:
        model = Reservation
        fields = (
            "id",
            "room",
            "guest",
            "check_in",
            "check_out",
            "guest_count",
            "status",
            "internal_notes",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_by", "created_at", "updated_at")

    def validate(self, attributes: dict[str, object]) -> dict[str, object]:
        """Apply interval, creation-date, capacity and status-transition rules."""
        instance = self.instance
        room = attributes.get("room", getattr(instance, "room", None))
        check_in = attributes.get("check_in", getattr(instance, "check_in", None))
        check_out = attributes.get("check_out", getattr(instance, "check_out", None))
        guest_count = attributes.get(
            "guest_count", getattr(instance, "guest_count", None)
        )
        status = attributes.get("status", getattr(instance, "status", None))

        errors = {}

        if check_in and check_out and check_out <= check_in:
            errors["check_out"] = ErrorDetail(
                "Check-out must be later than check-in.",
                code="check_out_not_after_check_in",
            )
        elif (
            instance is None
            and check_out
            and check_out < timezone.localdate()
        ):
            errors["check_out"] = ErrorDetail(
                "Check-out date cannot be in the past.",
                code="check_out_in_past",
            )

        if room and guest_count and guest_count > room.capacity:
            errors["guest_count"] = ErrorDetail(
                "Guest count exceeds room capacity.",
                code="guest_count_exceeds_capacity",
            )

        if (
            instance is not None
            and status is not None
            and status != instance.status
            and status not in ALLOWED_STATUS_TRANSITIONS.get(
                instance.status, frozenset()
            )
        ):
            errors["status"] = ErrorDetail(
                "Invalid status transition.",
                code="invalid_status_transition",
            )

        if errors:
            raise serializers.ValidationError(errors)

        return attributes
