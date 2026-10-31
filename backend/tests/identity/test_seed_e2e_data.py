"""Safety checks for the disposable browser-test data command."""

import pytest
from django.core.management.base import CommandError

from identity.management.commands import seed_e2e_data


class FakeConnection:
    """Minimal database connection replacement for command safety tests."""

    def __init__(self, name: str, host: str) -> None:
        self.settings_dict = {"NAME": name, "HOST": host}


def test_seed_e2e_data_refuses_without_explicit_e2e_marker(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("EL_CRUCE_E2E", raising=False)
    monkeypatch.setattr(
        seed_e2e_data,
        "connections",
        {"default": FakeConnection("elcruce_e2e", "db")},
    )

    with pytest.raises(CommandError, match="EL_CRUCE_E2E=1"):
        seed_e2e_data.Command().handle()


@pytest.mark.parametrize(
    ("database_name", "database_host"),
    [("elcruce", "db"), ("elcruce_e2e", "localhost")],
)
def test_seed_e2e_data_refuses_a_database_outside_the_compose_e2e_target(
    monkeypatch: pytest.MonkeyPatch, database_name: str, database_host: str
) -> None:
    monkeypatch.setenv("EL_CRUCE_E2E", "1")
    monkeypatch.setattr(
        seed_e2e_data,
        "connections",
        {"default": FakeConnection(database_name, database_host)},
    )

    with pytest.raises(CommandError, match="seed_e2e_data only permits"):
        seed_e2e_data.Command().handle()


def test_seed_e2e_data_writes_only_to_the_marked_compose_target(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seeded = False

    def record_seed(self) -> None:
        nonlocal seeded
        seeded = True

    monkeypatch.setenv("EL_CRUCE_E2E", "1")
    monkeypatch.setattr(
        seed_e2e_data,
        "connections",
        {"default": FakeConnection("elcruce_e2e", "db")},
    )
    monkeypatch.setattr(seed_e2e_data.Command, "_seed", record_seed)

    seed_e2e_data.Command().handle()

    assert seeded is True
