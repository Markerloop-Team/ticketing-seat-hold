import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from ticketing.errors import InvalidTicketCode
from ticketing.services.holds import place_hold
from ticketing.services.orders import confirm_payment
from ticketing.services.tickets import parse_ticket_code, ticket_code

from .conftest import seat_ids


@pytest.fixture
def ticket(event):
    hold = place_hold(event, seat_ids(event, 1))
    order = confirm_payment(hold, payment_reference="pay_1", email="guest@example.com")
    return order.tickets.get()


def test_code_roundtrip(ticket):
    assert parse_ticket_code(ticket_code(ticket)) == ticket.public_id


@pytest.mark.parametrize(
    "mangle",
    [
        lambda c: c[:-1] + ("A" if c[-1] != "A" else "B"),  # signature
        lambda c: ("0" if c[0] != "0" else "1") + c[1:],  # id
        lambda c: c.split(":")[0],  # no signature
        lambda c: "not-a-ticket",
    ],
)
def test_tampered_code_is_rejected(ticket, mangle):
    with pytest.raises(InvalidTicketCode):
        parse_ticket_code(mangle(ticket_code(ticket)))


def test_codes_survive_secret_key_rotation(ticket):
    with override_settings(SECRET_KEY="old-key"):
        code = ticket_code(ticket)
    with override_settings(SECRET_KEY="new-key", SECRET_KEY_FALLBACKS=["old-key"]):
        assert parse_ticket_code(code) == ticket.public_id
    with override_settings(SECRET_KEY="new-key"), pytest.raises(InvalidTicketCode):
        parse_ticket_code(code)


def test_order_exposes_codes_and_qr(ticket):
    api = APIClient()
    data = api.get(f"/api/orders/{ticket.order.token}/").json()
    code = data["tickets"][0]["code"]
    assert code == ticket_code(ticket)

    resp = api.get(f"/api/tickets/{code}/qr.svg")
    assert resp.status_code == 200
    assert resp["Content-Type"] == "image/svg+xml"
    assert b"<svg" in resp.content
    assert api.get("/api/tickets/forged:code/qr.svg").status_code == 400
