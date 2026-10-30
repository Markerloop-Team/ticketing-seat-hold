from collections.abc import Iterable
from datetime import datetime, timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from ticketing.errors import HoldLimitExceeded, HoldNotActive, SeatsUnavailable
from ticketing.models import Event, EventSeat, Hold


def hold_ttl() -> timedelta:
    return timedelta(seconds=settings.SEAT_HOLD_TTL_SECONDS)


def claimable_q(now: datetime) -> Q:
    # A held seat whose hold has lapsed is up for grabs even before the
    # cleanup task gets to it.
    return Q(status=EventSeat.Status.FREE) | Q(status=EventSeat.Status.HELD, held_until__lte=now)


def place_hold(event: Event, seat_ids: Iterable[int], *, now: datetime | None = None) -> Hold:
    seat_ids = sorted(set(seat_ids))
    if not seat_ids:
        raise HoldLimitExceeded("Select at least one seat.")
    if len(seat_ids) > event.max_seats_per_hold:
        raise HoldLimitExceeded(
            f"At most {event.max_seats_per_hold} seats per order.",
            limit=event.max_seats_per_hold,
        )

    now = now or timezone.now()
    with transaction.atomic():
        hold = Hold.objects.create(event=event, expires_at=now + hold_ttl())
        rows = EventSeat.objects.filter(event=event, seat_id__in=seat_ids)

        # Lock in primary-key order so two overlapping multi-seat holds can't
        # deadlock each other. No-op on SQLite, which serialises writers anyway.
        list(rows.select_for_update().order_by("pk").values_list("pk", flat=True))

        # The conditional UPDATE is the real guard: it only touches rows that
        # are still claimable at write time, so the row count tells us whether
        # we got every seat we asked for.
        claimed = rows.filter(claimable_q(now)).update(
            status=EventSeat.Status.HELD, hold=hold, held_until=hold.expires_at
        )
        if claimed != len(seat_ids):
            ours = set(rows.filter(hold=hold).values_list("seat_id", flat=True))
            # Raising inside atomic() rolls back the partial claim and the hold.
            raise SeatsUnavailable(
                "Some seats are no longer available.",
                seat_ids=[s for s in seat_ids if s not in ours],
            )
    return hold


def release_hold(hold: Hold) -> None:
    with transaction.atomic():
        hold = Hold.objects.select_for_update().get(pk=hold.pk)
        if hold.status != Hold.Status.ACTIVE:
            raise HoldNotActive(f"Hold is {hold.status}.")
        _free_seats([hold.pk])
        hold.status = Hold.Status.RELEASED
        hold.save(update_fields=["status"])


def _free_seats(hold_ids: list[int]) -> int:
    return EventSeat.objects.filter(hold_id__in=hold_ids, status=EventSeat.Status.HELD).update(
        status=EventSeat.Status.FREE, hold=None, held_until=None
    )
