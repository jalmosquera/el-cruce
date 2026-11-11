"""Typed persistence models for business-owned public configuration."""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q


MADRID_TIME_ZONE = "Europe/Madrid"
HEX_COLOR_PATTERN = r"^#[0-9A-Fa-f]{6}$"


class Weekday(models.IntegerChoices):
    """ISO weekday values used by weekly restaurant schedules."""

    MONDAY = 0, "Monday"
    TUESDAY = 1, "Tuesday"
    WEDNESDAY = 2, "Wednesday"
    THURSDAY = 3, "Thursday"
    FRIDAY = 4, "Friday"
    SATURDAY = 5, "Saturday"
    SUNDAY = 6, "Sunday"


class PublicPalette(models.Model):
    """A named five-colour public theme; predefined records are immutable."""

    key = models.SlugField(max_length=48, unique=True)
    name = models.CharField(max_length=80, unique=True)
    primary = models.CharField(max_length=7)
    background = models.CharField(max_length=7)
    text = models.CharField(max_length=7)
    secondary = models.CharField(max_length=7)
    accent = models.CharField(max_length=7)
    is_predefined = models.BooleanField(default=False, editable=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="created_public_palettes",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("is_predefined", "name", "pk")
        constraints = [
            *[
                models.CheckConstraint(
                    condition=Q(**{f"{field}__regex": HEX_COLOR_PATTERN}),
                    name=f"configuration_palette_{field}_hex",
                )
                for field in ("primary", "background", "text", "secondary", "accent")
            ],
        ]

    def clean(self) -> None:
        super().clean()
        for field_name in ("primary", "background", "text", "secondary", "accent"):
            value = getattr(self, field_name)
            if not value or len(value) != 7 or not value.startswith("#"):
                raise ValidationError({field_name: "Use a six-digit HEX color."})
            try:
                int(value[1:], 16)
            except ValueError as error:
                raise ValidationError({field_name: "Use a six-digit HEX color."}) from error

    def save(self, *args, **kwargs) -> None:
        if self.pk and self.is_predefined:
            original = type(self).objects.filter(pk=self.pk).values(
                "key", "name", "primary", "background", "text", "secondary", "accent", "is_predefined", "created_by_id"
            ).first()
            current = {
                field: getattr(self, field)
                for field in ("key", "name", "primary", "background", "text", "secondary", "accent", "is_predefined")
            }
            current["created_by_id"] = self.created_by_id
            if original != current:
                raise ValidationError("Predefined public palettes are immutable.")
        self.full_clean()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs) -> None:
        if self.is_predefined:
            raise ValidationError("Predefined public palettes cannot be deleted.")
        super().delete(*args, **kwargs)


class BusinessConfiguration(models.Model):
    """Singleton configuration split into draft and published public themes."""

    singleton = models.BooleanField(default=True, unique=True, editable=False)
    draft_palette = models.ForeignKey(
        PublicPalette,
        blank=True,
        null=True,
        on_delete=models.PROTECT,
        related_name="draft_for_configurations",
    )
    published_palette = models.ForeignKey(
        PublicPalette,
        blank=True,
        null=True,
        on_delete=models.PROTECT,
        related_name="published_for_configurations",
    )
    check_in_from = models.TimeField(blank=True, null=True)
    check_in_until = models.TimeField(blank=True, null=True)
    check_out_from = models.TimeField(blank=True, null=True)
    check_out_until = models.TimeField(blank=True, null=True)
    reception_from = models.TimeField(blank=True, null=True)
    reception_until = models.TimeField(blank=True, null=True)
    accommodation_instructions = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(singleton=True),
                name="configuration_business_configuration_is_singleton",
            )
        ]

    @classmethod
    def get_solo(cls) -> "BusinessConfiguration":
        configuration, _ = cls.objects.get_or_create(singleton=True)
        return configuration


class RestaurantWeeklySchedule(models.Model):
    """One Europe/Madrid restaurant opening interval for an ISO weekday."""

    weekday = models.PositiveSmallIntegerField(choices=Weekday.choices)
    opens_at = models.TimeField()
    closes_at = models.TimeField()

    class Meta:
        ordering = ("weekday", "opens_at", "pk")
        constraints = [
            models.CheckConstraint(
                condition=Q(weekday__in=Weekday.values),
                name="configuration_weekly_schedule_weekday_valid",
            ),
            models.UniqueConstraint(
                fields=("weekday", "opens_at", "closes_at"),
                name="configuration_weekly_schedule_interval_unique",
            ),
        ]


class RestaurantSpecialSchedule(models.Model):
    """A date-specific restaurant opening override in Europe/Madrid."""

    date = models.DateField(unique=True)
    is_closed = models.BooleanField(default=False)

    class Meta:
        ordering = ("date",)


class RestaurantSpecialScheduleInterval(models.Model):
    """An opening interval belonging to a date-specific schedule override."""

    special_schedule = models.ForeignKey(
        RestaurantSpecialSchedule,
        on_delete=models.CASCADE,
        related_name="intervals",
    )
    opens_at = models.TimeField()
    closes_at = models.TimeField()

    class Meta:
        ordering = ("opens_at", "pk")
        constraints = [
            models.UniqueConstraint(
                fields=("special_schedule", "opens_at", "closes_at"),
                name="configuration_special_schedule_interval_unique",
            )
        ]


class AccommodationException(models.Model):
    """A date-specific operational accommodation note or restriction."""

    date = models.DateField(unique=True)
    description = models.TextField(max_length=1000)

    class Meta:
        ordering = ("date",)
        constraints = [
            models.CheckConstraint(
                condition=Q(description__regex=r"\S"),
                name="configuration_accommodation_exception_non_blank",
            )
        ]


class ConfigurationAuditEvent(models.Model):
    """Minimal append-only trace of configuration mutations."""

    event_type = models.CharField(max_length=48)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.PROTECT,
        related_name="configuration_audit_events",
    )
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at", "-pk")

    def save(self, *args, **kwargs) -> None:
        if self.pk:
            raise ValidationError("Configuration audit events are append-only.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs) -> None:
        raise ValidationError("Configuration audit events are append-only.")
