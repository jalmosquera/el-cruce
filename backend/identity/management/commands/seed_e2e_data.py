"""Create deterministic fictitious records for the disposable browser-test database."""

from datetime import datetime, time, timedelta
from os import environ

from django.core.management.base import BaseCommand
from django.core.management.base import CommandError
from django.db import connections
from django.utils import timezone

from employees.models import Employee, Shift
from guests.models import Guest
from identity.models import User, UserRole
from menu.models import Category, CategoryTranslation, Dish, DishTranslation
from qr_codes.models import QrCode
from reservations.models import Reservation, ReservationStatus
from rooms.models import Room, RoomStatus


E2E_PASSWORD = "e2e-only-password"
E2E_DATABASE_PREFIX = "elcruce_e2e"
E2E_DATABASE_HOST = "db"


class Command(BaseCommand):
    """Seed data used exclusively by ``compose.e2e.yaml``."""

    help = "Seed deterministic fictitious data for the disposable Playwright E2E database."

    def handle(self, *args, **options):
        self._validate_e2e_target()
        self._seed()
        self.stdout.write(self.style.SUCCESS("Seeded disposable E2E data."))

    @staticmethod
    def _validate_e2e_target():
        """Refuse writes unless this is the dedicated Compose E2E database."""
        database_settings = connections["default"].settings_dict
        database_name = str(database_settings.get("NAME", ""))
        database_host = str(database_settings.get("HOST", ""))

        if environ.get("EL_CRUCE_E2E") != "1":
            raise CommandError("seed_e2e_data requires EL_CRUCE_E2E=1.")
        if not database_name.startswith(E2E_DATABASE_PREFIX):
            raise CommandError(
                f"seed_e2e_data only permits databases beginning with {E2E_DATABASE_PREFIX!r}."
            )
        if database_host != E2E_DATABASE_HOST:
            raise CommandError(
                f"seed_e2e_data only permits the Compose database host {E2E_DATABASE_HOST!r}."
            )

    def _seed(self):
        manager = self._user("e2e-manager", UserRole.MANAGER)
        self._user("e2e-administrator", UserRole.ADMINISTRATOR)
        employee_user = self._user("e2e-employee", UserRole.EMPLOYEE)

        employee, _ = Employee.objects.get_or_create(user=employee_user)
        today = timezone.localdate()
        Shift.objects.get_or_create(
            employee=employee,
            starts_at=timezone.make_aware(
                datetime.combine(today + timedelta(days=2), time(hour=9))
            ),
            defaults={
                "ends_at": timezone.make_aware(
                    datetime.combine(today + timedelta(days=2), time(hour=17))
                )
            },
        )

        room_101, _ = Room.objects.update_or_create(
            code="101",
            defaults={"name": "Habitación e2e doble", "capacity": 2, "status": RoomStatus.OPERATIONAL},
        )
        Room.objects.update_or_create(
            code="102",
            defaults={"name": "Habitación e2e familiar", "capacity": 4, "status": RoomStatus.OPERATIONAL},
        )
        guest, _ = Guest.objects.update_or_create(
            display_name="Andrea Prueba",
            defaults={
                "email": "andrea.prueba@example.test",
                "phone": "+34600111222",
                "document_type": "dni",
                "document_number": "12345678Z",
                "internal_notes": "Registro ficticio exclusivo para E2E.",
            },
        )
        Reservation.objects.get_or_create(
            room=room_101,
            guest=guest,
            check_in=today + timedelta(days=14),
            check_out=today + timedelta(days=16),
            defaults={
                "guest_count": 2,
                "status": ReservationStatus.CONFIRMED,
                "created_by": manager,
                "internal_notes": "Reserva ficticia de referencia.",
            },
        )

        category, _ = Category.objects.update_or_create(
            spanish_name="Entrantes de prueba",
            defaults={"is_published": True},
        )
        dish, _ = Dish.objects.update_or_create(
            visible_number=901,
            defaults={
                "category": category,
                "spanish_name": "Tortilla de prueba",
                "spanish_description": "Patata, huevo y cebolla.",
                "price": "8.50",
                "allergens": ["eggs"],
                "is_published": True,
                "is_available": True,
            },
        )
        CategoryTranslation.objects.update_or_create(
            category=category,
            language="en",
            defaults={"name": "Test starters", "is_manually_reviewed": True},
        )
        CategoryTranslation.objects.update_or_create(
            category=category,
            language="fr",
            defaults={"name": "Entrées de test", "is_manually_reviewed": True},
        )
        DishTranslation.objects.update_or_create(
            dish=dish,
            language="en",
            defaults={
                "name": "Test omelette",
                "description": "Potato, egg and onion.",
                "is_manually_reviewed": True,
            },
        )
        DishTranslation.objects.update_or_create(
            dish=dish,
            language="fr",
            defaults={
                "name": "Omelette de test",
                "description": "Pomme de terre, œuf et oignon.",
                "is_manually_reviewed": True,
            },
        )
        QrCode.objects.update_or_create(
            name="Carta E2E",
            defaults={"target_path": "/carta", "is_active": True, "created_by": manager},
        )

    @staticmethod
    def _user(username, role):
        user, _ = User.objects.get_or_create(username=username, defaults={"role": role})
        user.role = role
        user.set_password(E2E_PASSWORD)
        user.save(update_fields=["role", "password"])
        return user
