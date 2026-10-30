from datetime import datetime

from django.db import transaction
from django.utils import timezone

from ticketing.errors import HoldNotActive, PaymentReferenceConflict
from ticketing.models import EventSeat, Hold, Order, Ticket


def confirm_payment(
    hold: Hold, *, payment_reference: str, email: str, now: datetime | None = None
) -> Order:
    """Turn an active hold into a paid order. Idempotent per hold and per payment reference."""
    now = now or timezone.now()
    with transaction.atomic():
        # Locking the hold serialises us against a retry of the same callback
        # and against the expiry task (which skips locked holds).
        hold = Hold.objects.select_for_update().get(pk=hold.pk)

        existing = Order.objects.filter(payment_reference=payment_reference).first()
        if existing is not None:
            if existing.hold_id != hold.pk:
                raise PaymentReferenceConflict("Payment reference belongs to another order.")
            return existing

        if hold.status != Hold.Status.ACTIVE or hold.expires_at <= now:
            # Money arrived after the seats were gone: the caller has to refund.
            raise HoldNotActive("Hold has expired or was released.")

        seats = list(
            EventSeat.objects.filter(hold=hold, status=EventSeat.Status.HELD).select_related(
                "price_group"
            )
        )
        if not seats:
            raise HoldNotActive("Hold no longer owns any seats.")
        EventSeat.objects.filter(pk__in=[s.pk for s in seats]).update(
            status=EventSeat.Status.SOLD, held_until=None
        )

        order = Order.objects.create(
            hold=hold,
            event_id=hold.event_id,
            email=email,
            amount=sum(s.price_group.price for s in seats),
            payment_reference=payment_reference,
            paid_at=now,
        )
        Ticket.objects.bulk_create(
            Ticket(order=order, event_seat=s, price=s.price_group.price) for s in seats
        )
        hold.status = Hold.Status.CONFIRMED
        hold.save(update_fields=["status"])
    return order
