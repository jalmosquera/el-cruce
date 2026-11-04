"""Persistence models for internally managed reservations."""

from django.conf import settings
from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import DateRangeField, RangeOperators
from django.core.exceptions import ValidationError
from django.core.validators import MaxLengthValidator, MinValueValidator
from django.db import models
from django.db.models import F, Func, Q, Value
from django.utils import timezone


class ReservationStatus(models.TextChoices):
    """Lifecycle states of an internal reservation."""

    PENDING = "pending", "Pending"
    CONFIRMED = "confirmed", "Confirmed"
    CHECKED_IN = "checked_in", "Checked in"
    CHECKED_OUT = "checked_out", "Checked out"
    CANCELLED = "cancelled", "Cancelled"
    NO_SHOW = "no_show", "No show"


# Only these statuses reserve a room. Terminal statuses must never block a room.
OCCUPYING_RESERVATION_STATUSES = (
    ReservationStatus.PENDING,
    ReservationStatus.CONFIRMED,
    ReservationStatus.CHECKED_IN,
)

ALLOWED_STATUS_TRANSITIONS = {
    ReservationStatus.PENDING: frozenset(
        {ReservationStatus.CONFIRMED, ReservationStatus.CANCELLED}
    ),
    ReservationStatus.CONFIRMED: frozenset(
        {
            ReservationStatus.CHECKED_IN,
            ReservationStatus.CANCELLED,
            ReservationStatus.NO_SHOW,
        }
    ),
    ReservationStatus.CHECKED_IN: frozenset({ReservationStatus.CHECKED_OUT}),
    ReservationStatus.CHECKED_OUT: frozenset(),
    ReservationStatus.CANCELLED: frozenset(),
    ReservationStatus.NO_SHOW: frozenset(),
}

INTERNAL_NOTES_MAX_LENGTH = 2000


class ReservationDateRange(Func):
    """Build a PostgreSQL date range with explicit half-open ``[)`` bounds."""

    function = "DATERANGE"
    arity = 3
    output_field = DateRangeField()


class Reservation(models.Model):
    """A room stay requested by or for an internal guest."""

    room = models.ForeignKey(
        "rooms.Room",
        on_delete=models.PROTECT,
        related_name="reservations",
    )
    guest = models.ForeignKey(
        "guests.Guest",
        on_delete=models.PROTECT,
        related_name="reservations",
    )
    check_in = models.DateField()
    check_out = models.DateField()
    guest_count = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1)],
    )
    status = models.CharField(
        choices=ReservationStatus.choices,
        default=ReservationStatus.PENDING,
        max_length=20,
    )
    internal_notes = models.TextField(
        blank=True,
        default="",
        validators=[MaxLengthValidator(INTERNAL_NOTES_MAX_LENGTH)],
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_reservations",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("check_in", "pk")
        constraints = [
            models.CheckConstraint(
                condition=Q(check_out__gt=F("check_in")),
                name="reservations_reservation_check_out_after_check_in",
            ),
            models.CheckConstraint(
                condition=Q(guest_count__gt=0),
                name="reservations_reservation_guest_count_gt_zero",
            ),
            models.CheckConstraint(
                condition=Q(status__in=ReservationStatus.values),
                name="reservations_reservation_status_valid",
            ),
            ExclusionConstraint(
                name="reservations_reservation_no_room_overlap",
                expressions=[
                    ("room", RangeOperators.EQUAL),
                    (
                        ReservationDateRange(
                            "check_in",
                            "check_out",
                            Value("[)"),
                        ),
                        RangeOperators.OVERLAPS,
                    ),
                ],
                condition=Q(status__in=OCCUPYING_RESERVATION_STATUSES),
                violation_error_code="overlapping_reservation",
                violation_error_message=(
                    "This room already has an overlapping reservation."
                ),
            ),
        ]

    def __str__(self) -> str:
        return f"{self.room_id}: {self.check_in} → {self.check_out}"

    def clean(self) -> None:
        """Validate interval, creation-date and capacity invariants."""
        super().clean()
        errors = {}

        if self.check_in and self.check_out and self.check_out <= self.check_in:
            errors["check_out"] = "Check-out must be later than check-in."

        if (
            self._state.adding
            and self.check_out
            and self.check_out < timezone.localdate()
        ):
            errors["check_out"] = "Check-out date cannot be in the past."

        if self.room_id and self.guest_count and self.guest_count > self.room.capacity:
            errors["guest_count"] = "Guest count exceeds room capacity."

        if errors:
            raise ValidationError(errors)
