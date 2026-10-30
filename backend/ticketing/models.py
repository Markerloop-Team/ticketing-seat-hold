import uuid

from django.db import models


class Venue(models.Model):
    name = models.CharField(max_length=200)
    # Hall plan. Each <path id="..."> matches a Section.svg_element_id.
    svg = models.TextField(blank=True)

    def __str__(self) -> str:
        return self.name


class Section(models.Model):
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name="sections")
    name = models.CharField(max_length=100)
    svg_element_id = models.SlugField(max_length=64)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["venue", "svg_element_id"], name="uniq_section_svg_element"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.venue} / {self.name}"


class Seat(models.Model):
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="seats")
    row = models.PositiveSmallIntegerField()
    number = models.PositiveSmallIntegerField()
    # Position on the section plan, in plan units.
    x = models.FloatField()
    y = models.FloatField()

    class Meta:
        ordering = ["row", "number"]
        constraints = [
            models.UniqueConstraint(fields=["section", "row", "number"], name="uniq_seat_position"),
        ]

    def __str__(self) -> str:
        return f"{self.section.name}, row {self.row}, seat {self.number}"


class Event(models.Model):
    venue = models.ForeignKey(Venue, on_delete=models.PROTECT, related_name="events")
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    starts_at = models.DateTimeField()
    max_seats_per_hold = models.PositiveSmallIntegerField(default=5)

    def __str__(self) -> str:
        return self.title


class PriceGroup(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="price_groups")
    name = models.CharField(max_length=50)
    color = models.CharField(max_length=7)
    price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self) -> str:
        return f"{self.name} ({self.price})"


class EventSeat(models.Model):
    """Sellable inventory: one row per seat per event."""

    class Status(models.TextChoices):
        FREE = "free"
        HELD = "held"
        SOLD = "sold"

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="seats")
    seat = models.ForeignKey(Seat, on_delete=models.PROTECT, related_name="+")
    price_group = models.ForeignKey(PriceGroup, on_delete=models.PROTECT, related_name="seats")
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.FREE)
    hold = models.ForeignKey(
        "Hold", null=True, blank=True, on_delete=models.SET_NULL, related_name="seats"
    )
    # Copy of hold.expires_at, kept on the row so the claim check is a single-row
    # predicate (see services.holds.place_hold).
    held_until = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["event", "seat"], name="uniq_event_seat"),
            models.CheckConstraint(
                condition=models.Q(status="held", hold__isnull=False, held_until__isnull=False)
                | ~models.Q(status="held"),
                name="held_seat_has_hold",
            ),
        ]
        indexes = [models.Index(fields=["event", "status"])]

    def __str__(self) -> str:
        return f"{self.event} / {self.seat} [{self.status}]"


class Hold(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active"
        CONFIRMED = "confirmed"
        RELEASED = "released"
        EXPIRED = "expired"

    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="holds")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        indexes = [models.Index(fields=["status", "expires_at"])]

    def __str__(self) -> str:
        return f"Hold {self.token} [{self.status}]"


class Order(models.Model):
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    hold = models.OneToOneField(Hold, on_delete=models.PROTECT, related_name="order")
    event = models.ForeignKey(Event, on_delete=models.PROTECT, related_name="orders")
    email = models.EmailField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    # Provider-side id; unique so a replayed callback can't create a second order.
    payment_reference = models.CharField(max_length=100, unique=True)
    paid_at = models.DateTimeField()

    def __str__(self) -> str:
        return f"Order {self.token}"


class Ticket(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="tickets")
    # One-to-one: the database itself refuses to sell a seat twice.
    event_seat = models.OneToOneField(EventSeat, on_delete=models.PROTECT, related_name="ticket")
    price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self) -> str:
        return f"Ticket {self.public_id}"
