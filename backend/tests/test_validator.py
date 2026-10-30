import pytest
from django.contrib.auth.models import Permission, User
from rest_framework.test import APIClient

from ticketing.errors import AlreadyRedeemed, InvalidTicketCode, WrongEvent
from ticketing.services.holds import place_hold
from ticketing.services.orders import confirm_payment
from ticketing.services.tickets import redeem, ticket_code

from .conftest import seat_ids
from .test_concurrency import race


@pytest.fixture
def gatekeeper(db):
    user = User.objects.create_user("gate-1")
    user.user_permissions.add(Permission.objects.get(codename="redeem_ticket"))
    return user


@pytest.fixture
def ticket(event):
    hold = place_hold(event, seat_ids(event, 1))
    return confirm_payment(hold, payment_reference="pay_1", email="g@example.com").tickets.get()


def test_ticket_redeems_once(ticket, gatekeeper):
    code = ticket_code(ticket)
    event_id = ticket.order.event_id

    first = redeem(code, event_id=event_id, by=gatekeeper)
    assert first.redeemed_at is not None
    assert first.redeemed_by == gatekeeper

    with pytest.raises(AlreadyRedeemed) as exc:
        redeem(code, event_id=event_id, by=gatekeeper)
    assert exc.value.extra["redeemed_at"] == first.redeemed_at.isoformat()


def test_ticket_for_another_event_is_refused(ticket, gatekeeper, make_event):
    other = make_event()
    with pytest.raises(WrongEvent):
        redeem(ticket_code(ticket), event_id=other.id, by=gatekeeper)
    ticket.refresh_from_db()
    assert ticket.redeemed_at is None


def test_forged_code_is_refused(gatekeeper, event):
    with pytest.raises(InvalidTicketCode):
        redeem("0" * 32 + ":forged", event_id=event.id, by=gatekeeper)


@pytest.mark.django_db(transaction=True)
def test_two_gates_scanning_together_admit_one(ticket, gatekeeper):
    code, event_id = ticket_code(ticket), ticket.order.event_id

    results = race(*[lambda: redeem(code, event_id=event_id, by=gatekeeper)] * 6)

    assert sum(not isinstance(r, Exception) for r in results) == 1, results
    assert sum(isinstance(r, AlreadyRedeemed) for r in results) == 5, results


def test_redeem_endpoint_requires_permission(ticket, gatekeeper):
    api = APIClient()
    body = {"code": ticket_code(ticket), "event_id": ticket.order.event_id}
    url = "/api/validator/redeem/"

    assert api.post(url, body, format="json").status_code == 403
    api.force_authenticate(User.objects.create_user("visitor"))
    assert api.post(url, body, format="json").status_code == 403

    api.force_authenticate(gatekeeper)
    ok = api.post(url, body, format="json")
    assert ok.status_code == 200
    assert ok.json()["row"] == 1
    again = api.post(url, body, format="json")
    assert again.status_code == 409
    assert again.json()["code"] == "already_redeemed"
