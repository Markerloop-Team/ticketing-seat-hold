from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from ticketing.errors import HoldNotActive, PaymentReferenceConflict, SeatsUnavailable
from ticketing.models import EventSeat, Hold, Order, Ticket
from ticketing.services.holds import place_hold, release_hold
from ticketing.services.orders import confirm_payment

from .conftest import seat_ids


def confirm(hold, ref="pay_1", **kw):
    return confirm_payment(hold, payment_reference=ref, email="guest@example.com", **kw)


def test_confirm_sells_seats_and_issues_tickets(event):
    ids = seat_ids(event, 6)
    hold = place_hold(event, [ids[0], ids[5]])  # one VIP, one standard

    order = confirm(hold)

    assert order.amount == Decimal("23000")
    assert order.tickets.count() == 2
    assert set(EventSeat.objects.filter(hold=hold).values_list("status", flat=True)) == {"sold"}
    hold.refresh_from_db()
    assert hold.status == Hold.Status.CONFIRMED


def test_confirm_is_idempotent_for_retried_callback(event):
    hold = place_hold(event, seat_ids(event, 2))
    first = confirm(hold)
    assert confirm(hold) == first
    assert Ticket.objects.count() == 2


def test_payment_reference_cannot_pay_for_two_holds(event):
    a, b = seat_ids(event, 2)
    confirm(place_hold(event, [a]))
    with pytest.raises(PaymentReferenceConflict):
        confirm(place_hold(event, [b]))


def test_expired_hold_cannot_be_confirmed(event):
    hold = place_hold(event, seat_ids(event, 1))
    with pytest.raises(HoldNotActive):
        confirm(hold, now=hold.expires_at + timedelta(seconds=1))
    assert not Order.objects.exists()


def test_released_hold_cannot_be_confirmed(event):
    hold = place_hold(event, seat_ids(event, 1))
    release_hold(hold)
    with pytest.raises(HoldNotActive):
        confirm(hold)


def test_sold_seat_is_not_holdable(event):
    seat = seat_ids(event, 1)
    confirm(place_hold(event, seat))

    with pytest.raises(SeatsUnavailable):
        place_hold(event, seat, now=timezone.now() + timedelta(days=1))


def test_database_rejects_second_ticket_for_a_seat(event):
    order = confirm(place_hold(event, seat_ids(event, 1)))
    ticket = order.tickets.get()
    with pytest.raises(IntegrityError), transaction.atomic():
        Ticket.objects.create(order=order, event_seat=ticket.event_seat, price=ticket.price)
