from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from ticketing.models import Event, EventSeat, PriceGroup, Seat, Section, Venue


@pytest.fixture
def make_event(db):
    """Event with one section of `rows` x `cols` seats; the first row is VIP."""

    counter = iter(range(1, 10_000))

    def factory(rows: int = 3, cols: int = 4, max_seats_per_hold: int = 5) -> Event:
        n = next(counter)
        venue = Venue.objects.create(name=f"Hall {n}")
        section = Section.objects.create(venue=venue, name="Stalls", svg_element_id="stalls")
        event = Event.objects.create(
            venue=venue,
            title=f"Swan Lake {n}",
            slug=f"swan-lake-{n}",
            starts_at=timezone.now() + timedelta(days=7),
            max_seats_per_hold=max_seats_per_hold,
        )
        vip = PriceGroup.objects.create(
            event=event, name="VIP", color="#c0392b", price=Decimal("15000")
        )
        standard = PriceGroup.objects.create(
            event=event, name="Standard", color="#2980b9", price=Decimal("8000")
        )
        for row in range(1, rows + 1):
            for number in range(1, cols + 1):
                seat = Seat.objects.create(
                    section=section, row=row, number=number, x=number * 10, y=row * 10
                )
                EventSeat.objects.create(
                    event=event, seat=seat, price_group=vip if row == 1 else standard
                )
        return event

    return factory


@pytest.fixture
def event(make_event):
    return make_event()


def seat_ids(event: Event, n: int | None = None) -> list[int]:
    ids = list(
        EventSeat.objects.filter(event=event).order_by("seat_id").values_list("seat_id", flat=True)
    )
    return ids if n is None else ids[:n]
