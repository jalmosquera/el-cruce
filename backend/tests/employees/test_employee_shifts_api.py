"""PostgreSQL-backed integration tests for employee profile and shift APIs."""

from datetime import datetime, timedelta

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.test import APIClient

from employees.models import Employee, Shift
from identity.models import User, UserRole

pytestmark = pytest.mark.django_db

EMPLOYEES_URL = "/api/employees/"
SHIFTS_URL = "/api/shifts/"
PASSWORD = "correct-horse-battery-staple"


@pytest.fixture
def scheduled_user() -> User:
    return User.objects.create_user(
        username="scheduled-employee",
        password=PASSWORD,
        role=UserRole.EMPLOYEE,
    )


@pytest.fixture
def employee(scheduled_user: User) -> Employee:
    return Employee.objects.create(user=scheduled_user)


def aware_datetime(hour: int) -> datetime:
    return timezone.make_aware(datetime(2026, 11, 2, hour, 0))


def shift_payload(employee: Employee, starts_at: datetime, ends_at: datetime) -> dict:
    return {
        "employee": employee.pk,
        "starts_at": starts_at.isoformat(),
        "ends_at": ends_at.isoformat(),
    }


@pytest.mark.parametrize("role", [UserRole.MANAGER, UserRole.ADMINISTRATOR])
def test_manager_and_administrator_can_manage_employee_profiles_and_shifts(
    role: str,
    scheduled_user: User,
) -> None:
    manager = User.objects.create_user(username=f"{role}-user", password=PASSWORD, role=role)
    client = APIClient()
    client.force_authenticate(manager)

    employee_response = client.post(EMPLOYEES_URL, {"user": scheduled_user.pk}, format="json")
    assert employee_response.status_code == 201
    employee_id = employee_response.data["id"]

    assert client.get(EMPLOYEES_URL).status_code == 200
    assert client.get(f"{EMPLOYEES_URL}{employee_id}/").status_code == 200
    assert (
        client.patch(
            f"{EMPLOYEES_URL}{employee_id}/",
            {"user": scheduled_user.pk},
            format="json",
        ).status_code
        == 200
    )

    starts_at = aware_datetime(9)
    shift_response = client.post(
        SHIFTS_URL,
        shift_payload(Employee.objects.get(pk=employee_id), starts_at, starts_at + timedelta(hours=8)),
        format="json",
    )
    assert shift_response.status_code == 201
    shift_id = shift_response.data["id"]

    assert client.get(SHIFTS_URL).status_code == 200
    assert client.get(f"{SHIFTS_URL}{shift_id}/").status_code == 200
    assert (
        client.patch(
            f"{SHIFTS_URL}{shift_id}/",
            {"ends_at": (starts_at + timedelta(hours=7)).isoformat()},
            format="json",
        ).status_code
        == 200
    )
    assert client.delete(f"{SHIFTS_URL}{shift_id}/").status_code == 204
    assert client.delete(f"{EMPLOYEES_URL}{employee_id}/").status_code == 204


@pytest.mark.parametrize("role", [UserRole.MANAGER, UserRole.ADMINISTRATOR])
def test_manager_and_administrator_can_reassign_an_employee_to_another_user(
    role: str,
    employee: Employee,
) -> None:
    operator = User.objects.create_user(username=f"{role}-user", password=PASSWORD, role=role)
    replacement_user = User.objects.create_user(
        username=f"{role}-replacement",
        password=PASSWORD,
        role=UserRole.EMPLOYEE,
    )
    client = APIClient()
    client.force_authenticate(operator)

    response = client.patch(
        f"{EMPLOYEES_URL}{employee.pk}/",
        {"user": replacement_user.pk},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["user"] == replacement_user.pk
    employee.refresh_from_db()
    assert employee.user_id == replacement_user.pk


@pytest.mark.parametrize("url", [EMPLOYEES_URL, SHIFTS_URL])
def test_anonymous_users_are_denied_employee_management(url: str) -> None:
    response = APIClient().get(url)

    assert response.status_code == 401


@pytest.mark.parametrize("url", [EMPLOYEES_URL, SHIFTS_URL])
def test_employees_are_denied_employee_management(url: str) -> None:
    user = User.objects.create_user(username="employee-user", password=PASSWORD, role=UserRole.EMPLOYEE)
    client = APIClient()
    client.force_authenticate(user)

    response = client.get(url)

    assert response.status_code == 403


def test_shift_api_rejects_naive_datetime_input(employee: Employee) -> None:
    manager = User.objects.create_user(username="manager", password=PASSWORD, role=UserRole.MANAGER)
    client = APIClient()
    client.force_authenticate(manager)

    response = client.post(
        SHIFTS_URL,
        {
            "employee": employee.pk,
            "starts_at": "2026-11-02T09:00:00",
            "ends_at": "2026-11-02T17:00:00+01:00",
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.data == {"starts_at": ["A timezone offset is required."]}


def test_shift_api_rejects_an_end_before_its_start(employee: Employee) -> None:
    manager = User.objects.create_user(username="manager", password=PASSWORD, role=UserRole.MANAGER)
    client = APIClient()
    client.force_authenticate(manager)

    response = client.post(
        SHIFTS_URL,
        shift_payload(employee, aware_datetime(17), aware_datetime(9)),
        format="json",
    )

    assert response.status_code == 400
    assert response.data == {"ends_at": ["The shift must end after it starts."]}


def test_shift_model_validation_requires_aware_dates_and_an_increasing_interval(
    employee: Employee,
) -> None:
    shift = Shift(
        employee=employee,
        starts_at=datetime(2026, 11, 2, 17, 0),
        ends_at=datetime(2026, 11, 2, 9, 0),
    )

    with pytest.raises(ValidationError) as error:
        shift.full_clean()

    assert "A timezone-aware datetime is required." in error.value.message_dict["starts_at"]
    assert "The shift must end after it starts." in error.value.message_dict["ends_at"]


def test_postgresql_constraint_rejects_overlapping_shifts_and_allows_adjacent_ones(
    employee: Employee,
) -> None:
    starts_at = aware_datetime(9)
    Shift.objects.create(
        employee=employee,
        starts_at=starts_at,
        ends_at=starts_at + timedelta(hours=8),
    )

    Shift.objects.create(
        employee=employee,
        starts_at=starts_at + timedelta(hours=8),
        ends_at=starts_at + timedelta(hours=16),
    )

    with pytest.raises(IntegrityError), transaction.atomic():
        Shift.objects.create(
            employee=employee,
            starts_at=starts_at + timedelta(hours=7),
            ends_at=starts_at + timedelta(hours=9),
        )


def test_shift_api_rejects_an_overlapping_shift(employee: Employee) -> None:
    starts_at = aware_datetime(9)
    Shift.objects.create(
        employee=employee,
        starts_at=starts_at,
        ends_at=starts_at + timedelta(hours=8),
    )
    manager = User.objects.create_user(username="manager", password=PASSWORD, role=UserRole.MANAGER)
    client = APIClient()
    client.force_authenticate(manager)

    response = client.post(
        SHIFTS_URL,
        shift_payload(employee, starts_at + timedelta(hours=7), starts_at + timedelta(hours=9)),
        format="json",
    )

    assert response.status_code == 400
    assert response.data == {
        "non_field_errors": ["This employee already has an overlapping shift."]
    }
