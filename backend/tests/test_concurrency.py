"""Hit the hold service from real threads with separate DB connections.

Runs on SQLite locally and on Postgres in CI (set DATABASE_URL).
"""

import threading
from collections.abc import Callable

import pytest
from django.db import connections

from ticketing.errors import SeatsUnavailable
from ticketing.models import EventSeat, Hold
from ticketing.services.holds import place_hold

from .conftest import seat_ids

pytestmark = pytest.mark.django_db(transaction=True)


def race(*jobs: Callable[[], object]) -> list[object]:
    barrier = threading.Barrier(len(jobs))
    results: list[object] = [None] * len(jobs)

    def run(i, job):
        try:
            barrier.wait()
            results[i] = job()
        except Exception as exc:
            results[i] = exc
        finally:
            connections.close_all()

    threads = [threading.Thread(target=run, args=(i, job)) for i, job in enumerate(jobs)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)
    return results


def test_same_seat_is_held_exactly_once(event):
    seat = seat_ids(event, 1)

    results = race(*[lambda: place_hold(event, seat)] * 8)

    winners = [r for r in results if isinstance(r, Hold)]
    losers = [r for r in results if isinstance(r, SeatsUnavailable)]
    assert len(winners) == 1, results
    assert len(losers) == 7, results
    assert EventSeat.objects.get(event=event, seat_id=seat[0]).hold == winners[0]
    assert Hold.objects.count() == 1


def test_overlapping_holds_never_leave_partial_claims(event):
    a, b, c = seat_ids(event, 3)

    results = race(lambda: place_hold(event, [a, b]), lambda: place_hold(event, [b, c]))

    winners = [r for r in results if isinstance(r, Hold)]
    assert len(winners) == 1, results
    held = set(
        EventSeat.objects.filter(event=event, status="held").values_list("seat_id", flat=True)
    )
    assert held == set(winners[0].seats.values_list("seat_id", flat=True))
    assert len(held) == 2
