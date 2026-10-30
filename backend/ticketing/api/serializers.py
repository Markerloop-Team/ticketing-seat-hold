from django.utils import timezone
from rest_framework import serializers

from ticketing.models import Event, EventSeat, Hold, Order, PriceGroup, Section, Ticket


class SectionSerializer(serializers.ModelSerializer):
    available = serializers.IntegerField(read_only=True)

    class Meta:
        model = Section
        fields = ["id", "name", "svg_element_id", "available"]


class EventSerializer(serializers.ModelSerializer):
    venue = serializers.CharField(source="venue.name")
    svg = serializers.CharField(source="venue.svg")
    sections = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            "id",
            "slug",
            "title",
            "starts_at",
            "max_seats_per_hold",
            "venue",
            "svg",
            "sections",
        ]

    def get_sections(self, event):
        return SectionSerializer(self.context["sections"], many=True).data


class PriceGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceGroup
        fields = ["id", "name", "color", "price"]


class SeatSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="seat_id")
    row = serializers.IntegerField(source="seat.row")
    number = serializers.IntegerField(source="seat.number")
    x = serializers.FloatField(source="seat.x")
    y = serializers.FloatField(source="seat.y")
    price_group = serializers.IntegerField(source="price_group_id")
    status = serializers.SerializerMethodField()

    class Meta:
        model = EventSeat
        fields = ["id", "row", "number", "x", "y", "price_group", "status"]

    def get_status(self, obj: EventSeat) -> str:
        # A lapsed hold reads as free; the cleanup task catches up later.
        if obj.status == EventSeat.Status.HELD and obj.held_until <= self.context["now"]:
            return EventSeat.Status.FREE
        return obj.status


class HoldRequestSerializer(serializers.Serializer):
    seat_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=False)


class HoldSerializer(serializers.ModelSerializer):
    event = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    seat_ids = serializers.SerializerMethodField()
    amount = serializers.SerializerMethodField()
    seconds_left = serializers.SerializerMethodField()

    class Meta:
        model = Hold
        fields = ["token", "event", "status", "expires_at", "seconds_left", "seat_ids", "amount"]

    def get_seat_ids(self, hold):
        return sorted(s.seat_id for s in hold.seats.all())

    def get_amount(self, hold):
        return str(sum((s.price_group.price for s in hold.seats.all()), start=0))

    def get_seconds_left(self, hold):
        if hold.status != Hold.Status.ACTIVE:
            return 0
        return max(0, int((hold.expires_at - timezone.now()).total_seconds()))


class ConfirmPaymentSerializer(serializers.Serializer):
    payment_reference = serializers.CharField(max_length=100)
    email = serializers.EmailField()


class TicketSerializer(serializers.ModelSerializer):
    section = serializers.CharField(source="event_seat.seat.section.name")
    row = serializers.IntegerField(source="event_seat.seat.row")
    number = serializers.IntegerField(source="event_seat.seat.number")

    class Meta:
        model = Ticket
        fields = ["section", "row", "number", "price"]


class OrderSerializer(serializers.ModelSerializer):
    event = serializers.CharField(source="event.title")
    tickets = TicketSerializer(many=True)

    class Meta:
        model = Order
        fields = ["token", "event", "email", "amount", "paid_at", "tickets"]
