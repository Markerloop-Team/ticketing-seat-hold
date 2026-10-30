from datetime import timedelta

import pytest
from django.utils import timezone

from ticketing.errors import HoldLimitExceeded, HoldNotActive, SeatsUnavailable
from ticketing.models import EventSeat, Hold
from ticketing.services.holds import place_hold, release_hold

from .conftest import seat_ids


def statuses(event, ids):
    return dict(
        EventSeat.objects.filter(event=event, seat_id__in=ids).values_list("seat_id", "status")
    )


def test_hold_claims_seats_for_fifteen_minutes(event):
    ids = seat_ids(event, 2)
    now = timezone.now()

    hold = place_hold(event, ids, now=now)

    assert hold.status == Hold.Status.ACTIVE
    assert hold.expires_at == now + timedelta(minutes=15)
    assert statuses(event, ids) == {i: "held" for i in ids}
    assert set(hold.seats.values_list("seat_id", flat=True)) == set(ids)


def test_hold_is_all_or_nothing(event):
    a, b, c = seat_ids(event, 3)
    place_hold(event, [b])

    with pytest.raises(SeatsUnavailable) as exc:
        place_hold(event, [a, b, c])

    assert exc.value.extra["seat_ids"] == [b]
    assert statuses(event, [a, c]) == {a: "free", c: "free"}
    assert Hold.objects.count() == 1


def test_unknown_seat_is_rejected(event):
    with pytest.raises(SeatsUnavailable):
        place_hold(event, [seat_ids(event, 1)[0], 999_999])


def test_seat_limit_per_hold(make_event):
    event = make_event(max_seats_per_hold=2)
    with pytest.raises(HoldLimitExceeded):
        place_hold(event, seat_ids(event, 3))
    with pytest.raises(HoldLimitExceeded):
        place_hold(event, [])


def test_lapsed_hold_can_be_taken_over_before_cleanup(event):
    ids = seat_ids(event, 1)
    stale = place_hold(event, ids, now=timezone.now() - timedelta(minutes=16))

    fresh = place_hold(event, ids)

    assert EventSeat.objects.get(event=event, seat_id=ids[0]).hold == fresh
    assert not stale.seats.exists()


def test_release_frees_seats(event):
    ids = seat_ids(event, 2)
    hold = place_hold(event, ids)

    release_hold(hold)

    hold.refresh_from_db()
    assert hold.status == Hold.Status.RELEASED
    assert statuses(event, ids) == {i: "free" for i in ids}
    with pytest.raises(HoldNotActive):
        release_hold(hold)
