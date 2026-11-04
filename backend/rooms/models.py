"""Persistence models for internal accommodation rooms."""

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q


class RoomStatus(models.TextChoices):
    """Operational states that affect a room's internal use."""

    OPERATIONAL = "operational", "Operational"
    MAINTENANCE = "maintenance", "Maintenance"
    OUT_OF_SERVICE = "out_of_service", "Out of service"


class Room(models.Model):
    """An internally managed accommodation room with a stable operational code."""

    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=120)
    capacity = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    status = models.CharField(
        choices=RoomStatus.choices,
        default=RoomStatus.OPERATIONAL,
        max_length=20,
    )

    class Meta:
        ordering = ("code",)
        constraints = [
            models.CheckConstraint(
                condition=Q(capacity__gt=0),
                name="rooms_room_capacity_gt_zero",
            )
        ]

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"
