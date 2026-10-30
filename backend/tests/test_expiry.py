from datetime import timedelta

from django.utils import timezone

from ticketing.models import EventSeat, Hold
from ticketing.services.holds import place_hold
from ticketing.tasks import release_expired_holds

from .conftest import seat_ids


def test_task_releases_only_lapsed_holds(event):
    a, b, c = seat_ids(event, 3)
    lapsed = place_hold(event, [a, b], now=timezone.now() - timedelta(minutes=15, seconds=1))
    live = place_hold(event, [c])

    assert release_expired_holds() == 1

    lapsed.refresh_from_db()
    live.refresh_from_db()
    assert lapsed.status == Hold.Status.EXPIRED
    assert live.status == Hold.Status.ACTIVE
    seats = dict(EventSeat.objects.filter(event=event).values_list("seat_id", "status"))
    assert (seats[a], seats[b], seats[c]) == ("free", "free", "held")
    assert not EventSeat.objects.filter(seat_id__in=[a, b], hold__isnull=False).exists()


def test_task_is_idempotent(event):
    place_hold(event, seat_ids(event, 1), now=timezone.now() - timedelta(hours=1))
    assert release_expired_holds() == 1
    assert release_expired_holds() == 0


def test_task_drains_in_batches(event, monkeypatch):
    from ticketing.services import holds

    past = timezone.now() - timedelta(hours=1)
    for seat in seat_ids(event, 5):
        place_hold(event, [seat], now=past)
    original = holds.expire_holds
    monkeypatch.setattr("ticketing.tasks.expire_holds", lambda: original(batch_size=2))

    assert release_expired_holds() == 5
    assert not Hold.objects.filter(status=Hold.Status.ACTIVE).exists()


def test_task_does_not_touch_seat_taken_over_by_new_hold(event):
    seat = seat_ids(event, 1)
    stale = place_hold(event, seat, now=timezone.now() - timedelta(hours=1))
    fresh = place_hold(event, seat)

    release_expired_holds()

    stale.refresh_from_db()
    assert stale.status == Hold.Status.EXPIRED
    assert EventSeat.objects.get(event=event, seat_id=seat[0]).hold == fresh
