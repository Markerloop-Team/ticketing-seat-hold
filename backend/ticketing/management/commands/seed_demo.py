import secrets
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import Permission, User
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from ticketing.models import Event, EventSeat, PriceGroup, Seat, Section, Venue

HALL_SVG = """<svg viewBox="0 0 600 420" xmlns="http://www.w3.org/2000/svg">
  <rect x="180" y="20" width="240" height="40" rx="6" class="stage"/>
  <path id="stalls" d="M150 100 H450 L480 260 H120 Z"/>
  <path id="balcony-left" d="M40 120 L110 110 L100 330 L30 320 Z"/>
  <path id="balcony-right" d="M490 110 L560 120 L570 320 L500 330 Z"/>
</svg>"""

# section id -> (rows, seats per row)
LAYOUT = {"stalls": (8, 14), "balcony-left": (6, 4), "balcony-right": (6, 4)}


class Command(BaseCommand):
    help = "Create a demo venue, event and a gate user."

    @transaction.atomic
    def handle(self, *args, **options):
        if Event.objects.filter(slug="swan-lake").exists():
            self.stdout.write("Demo data already present.")
            return

        venue = Venue.objects.create(name="Grand Hall", svg=HALL_SVG)
        event = Event.objects.create(
            venue=venue,
            title="Swan Lake",
            slug="swan-lake",
            starts_at=timezone.now() + timedelta(days=14),
        )
        groups = {
            "vip": PriceGroup.objects.create(
                event=event, name="VIP", color="#d4543a", price=Decimal("15000")
            ),
            "stalls": PriceGroup.objects.create(
                event=event, name="Stalls", color="#3a7bd4", price=Decimal("9000")
            ),
            "balcony": PriceGroup.objects.create(
                event=event, name="Balcony", color="#3aa57a", price=Decimal("5000")
            ),
        }
        for element_id, (rows, per_row) in LAYOUT.items():
            section = Section.objects.create(
                venue=venue, name=element_id.replace("-", " ").title(), svg_element_id=element_id
            )
            for row in range(1, rows + 1):
                for number in range(1, per_row + 1):
                    seat = Seat.objects.create(
                        section=section, row=row, number=number, x=number * 24, y=row * 28
                    )
                    if element_id != "stalls":
                        group = groups["balcony"]
                    else:
                        group = groups["vip"] if row <= 2 else groups["stalls"]
                    EventSeat.objects.create(event=event, seat=seat, price_group=group)

        password = secrets.token_urlsafe(9)
        gate = User.objects.create_user("gate", password=password)
        gate.user_permissions.add(Permission.objects.get(codename="redeem_ticket"))
        self.stdout.write(f"Event: /api/events/{event.slug}/ (id={event.id})")
        self.stdout.write(f"Gate user: gate / {password}")
