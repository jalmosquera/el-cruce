"""Persistence models for internal identity and authorization."""

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q


class UserRole(models.TextChoices):
    """Roles available to internal El Cruce users."""

    ADMINISTRATOR = "administrator", "Administrator"
    MANAGER = "manager", "Manager"
    EMPLOYEE = "employee", "Employee"


class User(AbstractUser):
    """Internal user with a server-controlled operational role."""

    role = models.CharField(
        choices=UserRole.choices,
        default=UserRole.EMPLOYEE,
        max_length=20,
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(role__in=UserRole.values),
                name="identity_user_role_is_valid",
            )
        ]
