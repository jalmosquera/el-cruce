"""DRF serializers for typed business configuration APIs."""

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import (
    AccommodationException,
    BusinessConfiguration,
    PublicPalette,
    RestaurantSpecialSchedule,
    RestaurantWeeklySchedule,
    Weekday,
)
from .services import (
    validate_daily_intervals,
    validate_special_schedule_intervals,
    validate_weekly_intervals,
)


class PublicPaletteSerializer(serializers.ModelSerializer):
    """Expose exactly the public palette fields safe for internal selection."""

    primary = serializers.RegexField(r"^#[0-9A-Fa-f]{6}$")
    background = serializers.RegexField(r"^#[0-9A-Fa-f]{6}$")
    text = serializers.RegexField(r"^#[0-9A-Fa-f]{6}$")
    secondary = serializers.RegexField(r"^#[0-9A-Fa-f]{6}$")
    accent = serializers.RegexField(r"^#[0-9A-Fa-f]{6}$")

    class Meta:
        model = PublicPalette
        fields = (
            "id",
            "key",
            "name",
            "primary",
            "background",
            "text",
            "secondary",
            "accent",
            "is_predefined",
        )
        read_only_fields = ("id", "key", "is_predefined")


class CustomPublicPaletteSerializer(PublicPaletteSerializer):
    """Allow managers to create, but never modify, five-colour custom palettes."""

    key = serializers.SlugField(max_length=48)

    class Meta(PublicPaletteSerializer.Meta):
        read_only_fields = ("id", "is_predefined")

    def create(self, validated_data: dict) -> PublicPalette:
        return PublicPalette.objects.create(
            **validated_data,
            is_predefined=False,
            created_by=self.context["request"].user,
        )


class OpeningIntervalSerializer(serializers.Serializer):
    """A local Europe/Madrid wall-clock interval."""

    opens_at = serializers.TimeField()
    closes_at = serializers.TimeField()

    def validate(self, attrs: dict) -> dict:
        if attrs["opens_at"] == attrs["closes_at"]:
            raise serializers.ValidationError(
                {"closes_at": "Opening and closing times must differ."}
            )
        return attrs


class WeeklyOpeningIntervalSerializer(OpeningIntervalSerializer):
    """A weekly opening interval tied to an ISO weekday."""

    weekday = serializers.ChoiceField(choices=Weekday.choices)


class SpecialScheduleSerializer(serializers.Serializer):
    """A restaurant date override with zero or more opening intervals."""

    date = serializers.DateField()
    is_closed = serializers.BooleanField(default=False)
    intervals = OpeningIntervalSerializer(many=True, required=False, default=list)

    def validate(self, attrs: dict) -> dict:
        if attrs["is_closed"] and attrs["intervals"]:
            raise serializers.ValidationError(
                {"intervals": "Closed special schedules cannot have opening intervals."}
            )
        if not attrs["is_closed"] and not attrs["intervals"]:
            raise serializers.ValidationError(
                {"intervals": "An open special schedule requires an opening interval."}
            )
        try:
            validate_daily_intervals(attrs["intervals"])
        except DjangoValidationError as error:
            raise serializers.ValidationError({"intervals": error.messages}) from error
        return attrs


class RestaurantScheduleSerializer(serializers.Serializer):
    """Full replacement document for Europe/Madrid restaurant schedules."""

    timezone = serializers.CharField(read_only=True, default="Europe/Madrid")
    weekly_schedules = WeeklyOpeningIntervalSerializer(many=True)
    special_schedules = SpecialScheduleSerializer(many=True, required=False, default=list)

    def validate(self, attrs: dict) -> dict:
        try:
            validate_weekly_intervals(attrs["weekly_schedules"])
        except DjangoValidationError as error:
            raise serializers.ValidationError({"weekly_schedules": error.messages}) from error
        dates = [schedule["date"] for schedule in attrs["special_schedules"]]
        if len(dates) != len(set(dates)):
            raise serializers.ValidationError(
                {"special_schedules": "Only one special schedule is allowed per date."}
            )
        try:
            validate_special_schedule_intervals(attrs["special_schedules"])
        except DjangoValidationError as error:
            raise serializers.ValidationError({"special_schedules": error.messages}) from error
        return attrs


class AccommodationExceptionSerializer(serializers.ModelSerializer):
    """A date-specific operational accommodation exception."""

    class Meta:
        model = AccommodationException
        fields = ("date", "description")


class AccommodationSettingsSerializer(serializers.ModelSerializer):
    """Accommodation operational times, instructions, and date exceptions."""

    timezone = serializers.CharField(read_only=True, default="Europe/Madrid")
    exceptions = AccommodationExceptionSerializer(
        many=True, required=False, default=list, write_only=True
    )

    class Meta:
        model = BusinessConfiguration
        fields = (
            "timezone",
            "check_in_from",
            "check_in_until",
            "check_out_from",
            "check_out_until",
            "reception_from",
            "reception_until",
            "accommodation_instructions",
            "exceptions",
        )

    def validate(self, attrs: dict) -> dict:
        for start_field, end_field in (
            ("check_in_from", "check_in_until"),
            ("check_out_from", "check_out_until"),
            ("reception_from", "reception_until"),
        ):
            start = attrs.get(start_field, getattr(self.instance, start_field))
            end = attrs.get(end_field, getattr(self.instance, end_field))
            if (start is None) != (end is None):
                raise serializers.ValidationError(
                    {end_field: "Both ends of an accommodation time interval are required."}
                )
            if start is not None and start == end:
                raise serializers.ValidationError(
                    {end_field: "Accommodation time interval endpoints must differ."}
                )
        dates = [exception["date"] for exception in attrs.get("exceptions", [])]
        if len(dates) != len(set(dates)):
            raise serializers.ValidationError(
                {"exceptions": "Only one accommodation exception is allowed per date."}
            )
        return attrs


def serialize_restaurant_schedule() -> dict:
    """Return the complete persisted restaurant schedule document."""
    weekly = RestaurantWeeklySchedule.objects.all()
    special = RestaurantSpecialSchedule.objects.prefetch_related("intervals").all()
    return {
        "timezone": "Europe/Madrid",
        "weekly_schedules": WeeklyOpeningIntervalSerializer(weekly, many=True).data,
        "special_schedules": [
            {
                "date": schedule.date,
                "is_closed": schedule.is_closed,
                "intervals": OpeningIntervalSerializer(schedule.intervals.all(), many=True).data,
            }
            for schedule in special
        ],
    }


def serialize_accommodation_settings(configuration: BusinessConfiguration | None) -> dict:
    """Return persisted accommodation settings with date-specific exceptions."""
    return {
        "timezone": "Europe/Madrid",
        "check_in_from": configuration.check_in_from if configuration else None,
        "check_in_until": configuration.check_in_until if configuration else None,
        "check_out_from": configuration.check_out_from if configuration else None,
        "check_out_until": configuration.check_out_until if configuration else None,
        "reception_from": configuration.reception_from if configuration else None,
        "reception_until": configuration.reception_until if configuration else None,
        "accommodation_instructions": configuration.accommodation_instructions if configuration else "",
        "exceptions": AccommodationExceptionSerializer(
            AccommodationException.objects.all(), many=True
        ).data,
    }
