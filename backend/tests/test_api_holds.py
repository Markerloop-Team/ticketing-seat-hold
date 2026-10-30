import pytest
from rest_framework.test import APIClient

from .conftest import seat_ids


@pytest.fixture
def api():
    return APIClient()


def test_event_reports_available_seats_per_section(api, event):
    data = api.get(f"/api/events/{event.slug}/").json()
    assert data["sections"] == [
        {
            "id": data["sections"][0]["id"],
            "name": "Stalls",
            "svg_element_id": "stalls",
            "available": 12,
        }
    ]


def test_seat_map_and_hold_roundtrip(api, event):
    section_id = event.venue.sections.get().id
    url = f"/api/events/{event.slug}/sections/{section_id}/seats/"
    seats = api.get(url).json()
    assert [g["name"] for g in seats["price_groups"]] == ["VIP", "Standard"]
    assert {seat["status"] for seat in seats["seats"]} == {"free"}

    ids = seat_ids(event, 2)
    resp = api.post(f"/api/events/{event.slug}/holds/", {"seat_ids": ids}, format="json")
    assert resp.status_code == 201
    hold = resp.json()
    assert hold["seat_ids"] == ids
    assert hold["amount"] == "30000.00"
    assert 890 < hold["seconds_left"] <= 900

    statuses = {seat["id"]: seat["status"] for seat in api.get(url).json()["seats"]}
    assert [statuses[i] for i in ids] == ["held", "held"]

    assert api.delete(f"/api/holds/{hold['token']}/").status_code == 204
    assert api.get(f"/api/holds/{hold['token']}/").json()["status"] == "released"


def test_conflicting_hold_returns_409_with_taken_seats(api, event):
    ids = seat_ids(event, 2)
    api.post(f"/api/events/{event.slug}/holds/", {"seat_ids": ids[:1]}, format="json")

    resp = api.post(f"/api/events/{event.slug}/holds/", {"seat_ids": ids}, format="json")

    assert resp.status_code == 409
    assert resp.json()["code"] == "seats_unavailable"
    assert resp.json()["seat_ids"] == ids[:1]


def test_hold_over_limit_is_400(api, make_event):
    event = make_event(max_seats_per_hold=1)
    resp = api.post(
        f"/api/events/{event.slug}/holds/", {"seat_ids": seat_ids(event, 2)}, format="json"
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "hold_limit_exceeded"
