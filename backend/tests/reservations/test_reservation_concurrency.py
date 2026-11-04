"""Concurrency regression tests for reservations."""

import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from django.db import IntegrityError, connection, transaction
from django.utils import timezone
from rest_framework.test import APIClient

from guests.models import Guest
from identity.models import User, UserRole
from reservations.models import Reservation, ReservationStatus
from reservations.views import ReservationViewSet
from rooms.models import Room

pytestmark = pytest.mark.django_db(transaction=True)

RESERVATIONS_URL = "/api/reservations/"


def _attempt_overlapping_insert(
    *,
    room_id: int,
    guest_id: int,
    check_in,
    check_out,
    barrier: threading.Barrier,
) -> str:
    try:
        connection.ensure_connection()
        barrier.wait(timeout=10)
        with transaction.atomic():
            # Mirror the API's room serialization. Without it, PostgreSQL can
            # report a deadlock when both inserts check the exclusion constraint
            # at the same instant instead of a clean exclusion violation.
            Room.objects.select_for_update().get(pk=room_id)
            Reservation.objects.create(
                room_id=room_id,
                guest_id=guest_id,
                check_in=check_in,
                check_out=check_out,
                guest_count=1,
            )
        return "created"
    except IntegrityError:
        return "conflict"
    finally:
        connection.close()


def test_concurrent_overlapping_inserts_allow_exactly_one_reservation() -> None:
    room = Room.objects.create(code="101", name="Double room 101", capacity=2)
    guest = Guest.objects.create(display_name="Ana López")
    check_in = timezone.localdate() + timedelta(days=30)
    check_out = check_in + timedelta(days=2)
    barrier = threading.Barrier(2)

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(
                _attempt_overlapping_insert,
                room_id=room.pk,
                guest_id=guest.pk,
                check_in=check_in,
                check_out=check_out,
                barrier=barrier,
            )
            for _ in range(2)
        ]
        results = [future.result(timeout=20) for future in futures]

    assert sorted(results) == ["conflict", "created"]
    assert Reservation.objects.count() == 1


def _future_stay(offset_days: int = 30, nights: int = 2):
    check_in = timezone.localdate() + timedelta(days=offset_days)
    return check_in, check_in + timedelta(days=nights)


def _authenticated_client() -> APIClient:
    user = User.objects.create_user(
        username=f"concurrent-reservation-manager-{uuid.uuid4().hex}",
        password="not-used-by-force-authentication",
        role=UserRole.MANAGER,
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _patch_reservation(
    client: APIClient, reservation_id: int, payload: dict[str, object]
):
    try:
        connection.ensure_connection()
        return client.patch(
            f"{RESERVATIONS_URL}{reservation_id}/",
            payload,
            format="json",
        )
    finally:
        connection.close()


def _install_blocking_room_lock(monkeypatch, barrier: threading.Barrier) -> None:
    """Force both requests to finish pre-lock validation before either locks.

    A room reassignment may lock more than one room. Only the first lock of each
    request is gated, so the barrier synchronizes the competing requests without
    blocking their later (ordered) room locks.
    """
    original_lock_room = ReservationViewSet._lock_room
    gated_threads: set[int] = set()
    gated_threads_lock = threading.Lock()

    def blocking_lock_room(room: Room, *args, **kwargs) -> Room:
        thread_id = threading.get_ident()
        with gated_threads_lock:
            is_first_lock = thread_id not in gated_threads
            gated_threads.add(thread_id)
        if is_first_lock:
            barrier.wait(timeout=10)
        return original_lock_room(room, *args, **kwargs)

    monkeypatch.setattr(
        ReservationViewSet,
        "_lock_room",
        staticmethod(blocking_lock_room),
    )


def test_concurrent_notes_update_cannot_revert_a_terminal_status(
    monkeypatch,
) -> None:
    room = Room.objects.create(code="101", name="Double room 101", capacity=2)
    guest = Guest.objects.create(display_name="Ana López")
    check_in, check_out = _future_stay()
    reservation = Reservation.objects.create(
        room=room,
        guest=guest,
        check_in=check_in,
        check_out=check_out,
        guest_count=2,
        status=ReservationStatus.CHECKED_IN,
    )
    barrier = threading.Barrier(2)
    _install_blocking_room_lock(monkeypatch, barrier)
    status_client = _authenticated_client()
    notes_client = _authenticated_client()

    with ThreadPoolExecutor(max_workers=2) as executor:
        status_future = executor.submit(
            _patch_reservation,
            status_client,
            reservation.pk,
            {"status": ReservationStatus.CHECKED_OUT},
        )
        notes_future = executor.submit(
            _patch_reservation,
            notes_client,
            reservation.pk,
            {"internal_notes": "Late checkout agreed."},
        )
        status_response = status_future.result(timeout=20)
        notes_response = notes_future.result(timeout=20)

    assert status_response.status_code == 200
    assert notes_response.status_code == 200
    reservation.refresh_from_db()
    assert reservation.status == ReservationStatus.CHECKED_OUT
    assert reservation.internal_notes == "Late checkout agreed."


def test_concurrent_conflicting_status_transitions_allow_exactly_one(
    monkeypatch,
) -> None:
    room = Room.objects.create(code="101", name="Double room 101", capacity=2)
    guest = Guest.objects.create(display_name="Ana López")
    check_in, check_out = _future_stay()
    reservation = Reservation.objects.create(
        room=room,
        guest=guest,
        check_in=check_in,
        check_out=check_out,
        guest_count=2,
        status=ReservationStatus.PENDING,
    )
    barrier = threading.Barrier(2)
    _install_blocking_room_lock(monkeypatch, barrier)
    confirmed_client = _authenticated_client()
    cancelled_client = _authenticated_client()

    with ThreadPoolExecutor(max_workers=2) as executor:
        confirmed_future = executor.submit(
            _patch_reservation,
            confirmed_client,
            reservation.pk,
            {"status": ReservationStatus.CONFIRMED},
        )
        cancelled_future = executor.submit(
            _patch_reservation,
            cancelled_client,
            reservation.pk,
            {"status": ReservationStatus.CANCELLED},
        )
        responses = [
            confirmed_future.result(timeout=20),
            cancelled_future.result(timeout=20),
        ]

    assert sorted(response.status_code for response in responses) == [200, 400]
    rejected_response = next(
        response for response in responses if response.status_code == 400
    )
    assert rejected_response.data["status"][0].code == "invalid_status_transition"
    accepted_response = next(
        response for response in responses if response.status_code == 200
    )
    reservation.refresh_from_db()
    assert reservation.status == accepted_response.data["status"]
    assert reservation.status in {
        ReservationStatus.CONFIRMED,
        ReservationStatus.CANCELLED,
    }


def test_concurrent_reassignment_cannot_persist_guest_count_above_capacity(
    monkeypatch,
) -> None:
    """A stale pre-lock room must not validate capacity after a concurrent move."""
    large_room = Room.objects.create(code="201", name="Family room 201", capacity=4)
    small_room = Room.objects.create(code="202", name="Double room 202", capacity=2)
    guest = Guest.objects.create(display_name="Ana López")
    check_in, check_out = _future_stay()
    reservation = Reservation.objects.create(
        room=large_room,
        guest=guest,
        check_in=check_in,
        check_out=check_out,
        guest_count=2,
        status=ReservationStatus.PENDING,
    )
    barrier = threading.Barrier(2)
    _install_blocking_room_lock(monkeypatch, barrier)
    reassignment_client = _authenticated_client()
    guest_count_client = _authenticated_client()

    with ThreadPoolExecutor(max_workers=2) as executor:
        reassignment_future = executor.submit(
            _patch_reservation,
            reassignment_client,
            reservation.pk,
            {"room": small_room.pk},
        )
        guest_count_future = executor.submit(
            _patch_reservation,
            guest_count_client,
            reservation.pk,
            {"guest_count": 4},
        )
        responses = [
            reassignment_future.result(timeout=20),
            guest_count_future.result(timeout=20),
        ]

    assert sorted(response.status_code for response in responses) == [200, 400]
    rejected_response = next(
        response for response in responses if response.status_code == 400
    )
    assert (
        rejected_response.data["guest_count"][0].code
        == "guest_count_exceeds_capacity"
    )

    reservation.refresh_from_db()
    assert reservation.room.capacity >= reservation.guest_count
    for stored_reservation in Reservation.objects.select_related("room"):
        assert stored_reservation.guest_count <= stored_reservation.room.capacity


def test_notes_update_during_two_sequential_room_moves_returns_conflict(
    monkeypatch,
) -> None:
    """A late-discovered room lock must fail fast instead of deadlocking.

    Three requests interleave:

    1. A notes update reads the reservation while it is still in room A.
    2. A first room move commits A -> B.
    3. A second room move locks B and C, then waits for the reservation row.
    4. The notes update locks the reservation, discovers room B only after that
       lock, and tries to lock room B while the second move still holds it.

    Blocking on that late room inverts the lock order used by room moves and
    used to produce a PostgreSQL deadlock (HTTP 500). The non-blocking lock makes
    the notes update lose with a controlled 409 while the move that overlaps it
    wins and commits.
    """
    room_a = Room.objects.create(code="301", name="Room 301", capacity=2)
    room_b = Room.objects.create(code="302", name="Room 302", capacity=2)
    room_c = Room.objects.create(code="303", name="Room 303", capacity=2)
    guest = Guest.objects.create(display_name="Ana López")
    check_in, check_out = _future_stay()
    reservation = Reservation.objects.create(
        room=room_a,
        guest=guest,
        check_in=check_in,
        check_out=check_out,
        guest_count=2,
        status=ReservationStatus.PENDING,
    )

    notes_snapshot_taken = threading.Event()
    first_move_finished = threading.Event()
    second_move_rooms_locked = threading.Event()
    notes_late_lock_reached = threading.Event()

    original_lock_room = ReservationViewSet._lock_room
    thread_labels = threading.local()
    notes_lock_calls = 0
    notes_lock_calls_lock = threading.Lock()

    def current_label() -> str | None:
        return getattr(thread_labels, "value", None)

    def coordinated_lock_room(room: Room, *args, **kwargs) -> Room:
        nonlocal notes_lock_calls
        label = current_label()
        if label == "notes":
            with notes_lock_calls_lock:
                notes_lock_calls += 1
                call_number = notes_lock_calls
            if call_number == 1:
                # The notes request already read its pre-lock snapshot.
                notes_snapshot_taken.set()
                if not first_move_finished.wait(timeout=10):
                    raise AssertionError("The first room move did not finish.")
            else:
                # The effective room was discovered only after the reservation
                # lock. Wait until the second move holds both room locks.
                if not second_move_rooms_locked.wait(timeout=10):
                    raise AssertionError("The second room move did not lock rooms.")
                notes_late_lock_reached.set()
        elif label == "first_move":
            if not notes_snapshot_taken.wait(timeout=10):
                raise AssertionError("The notes snapshot was not taken.")
        elif label == "second_move":
            locked_room = original_lock_room(room, *args, **kwargs)
            if room.pk == room_c.pk:
                second_move_rooms_locked.set()
                if not notes_late_lock_reached.wait(timeout=10):
                    raise AssertionError("The notes late lock was not reached.")
            return locked_room
        return original_lock_room(room, *args, **kwargs)

    monkeypatch.setattr(
        ReservationViewSet,
        "_lock_room",
        staticmethod(coordinated_lock_room),
    )

    def request_as(label: str, client: APIClient, payload: dict[str, object]):
        thread_labels.value = label
        try:
            response = _patch_reservation(client, reservation.pk, payload)
        finally:
            if label == "first_move":
                first_move_finished.set()
            thread_labels.value = None
        return response

    notes_client = _authenticated_client()
    first_move_client = _authenticated_client()
    second_move_client = _authenticated_client()

    with ThreadPoolExecutor(max_workers=2) as executor:
        notes_future = executor.submit(
            request_as,
            "notes",
            notes_client,
            {"internal_notes": "Late checkout agreed."},
        )
        first_move_future = executor.submit(
            request_as,
            "first_move",
            first_move_client,
            {"room": room_b.pk},
        )
        first_move_response = first_move_future.result(timeout=20)

        with ThreadPoolExecutor(max_workers=1) as second_executor:
            second_move_future = second_executor.submit(
                request_as,
                "second_move",
                second_move_client,
                {"room": room_c.pk},
            )
            second_move_response = second_move_future.result(timeout=20)

        notes_response = notes_future.result(timeout=20)

    responses = [notes_response, first_move_response, second_move_response]
    assert all(response.status_code != 500 for response in responses)
    assert sorted(response.status_code for response in responses) == [200, 200, 409]

    # The notes update and the second move overlapped in time: only the move won.
    assert notes_response.status_code == 409
    assert notes_response.data["detail"].code == "reservation_conflict"
    assert second_move_response.status_code == 200
    assert first_move_response.status_code == 200

    reservation.refresh_from_db()
    assert reservation.room == room_c
    assert reservation.internal_notes == ""
    assert reservation.status == ReservationStatus.PENDING
    assert Reservation.objects.count() == 1
