"""The whole slice over HTTP: seat map -> hold -> payment -> QR -> gate."""

from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from rest_framework.test import APIClient


def test_end_to_end(db):
    call_command("seed_demo", stdout=StringIO())
    buyer, gate = APIClient(), APIClient()
    gate.force_authenticate(User.objects.get(username="gate"))

    event = buyer.get("/api/events/swan-lake/").json()
    stalls = next(s for s in event["sections"] if s["svg_element_id"] == "stalls")
    assert stalls["available"] == 112

    seats = buyer.get(f"/api/events/swan-lake/sections/{stalls['id']}/seats/").json()["seats"]
    picked = [seats[0]["id"], seats[1]["id"]]

    hold = buyer.post("/api/events/swan-lake/holds/", {"seat_ids": picked}, format="json").json()
    assert hold["amount"] == "30000.00"

    order = buyer.post(
        f"/api/holds/{hold['token']}/confirm/",
        {"payment_reference": "psp-0001", "email": "guest@example.com"},
        format="json",
    )
    assert order.status_code == 201
    tickets = order.json()["tickets"]
    assert [(t["row"], t["number"]) for t in tickets] == [(1, 1), (1, 2)]

    event = buyer.get("/api/events/swan-lake/").json()
    assert next(s for s in event["sections"] if s["id"] == stalls["id"])["available"] == 110

    body = {"code": tickets[0]["code"], "event_id": event["id"]}
    assert gate.post("/api/validator/redeem/", body, format="json").status_code == 200
    assert gate.post("/api/validator/redeem/", body, format="json").status_code == 409


def test_seed_is_idempotent(db):
    call_command("seed_demo", stdout=StringIO())
    call_command("seed_demo", stdout=StringIO())
    assert User.objects.filter(username="gate").count() == 1
