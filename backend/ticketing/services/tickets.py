import io
import uuid
from datetime import datetime

import segno
from django.core import signing
from django.utils import timezone

from ticketing.errors import AlreadyRedeemed, InvalidTicketCode, TicketNotFound, WrongEvent
from ticketing.models import Ticket

_SALT = "ticketing.ticket-qr"


def ticket_code(ticket: Ticket) -> str:
    """Payload printed in the QR: `<public id>:<HMAC>`.

    The signature lets the gate reject forged or mistyped codes before any
    database lookup, and ids can't be guessed by walking a sequence. Signing
    uses SECRET_KEY, so SECRET_KEY_FALLBACKS keeps old tickets valid during a
    key rotation.
    """
    return signing.Signer(salt=_SALT).sign(ticket.public_id.hex)


def parse_ticket_code(code: str) -> uuid.UUID:
    try:
        return uuid.UUID(hex=signing.Signer(salt=_SALT).unsign(code.strip()))
    except (signing.BadSignature, ValueError) as exc:
        raise InvalidTicketCode("Ticket code is not valid.") from exc


def qr_svg(code: str) -> bytes:
    buf = io.BytesIO()
    segno.make(code, error="m").save(buf, kind="svg", scale=6, border=2)
    return buf.getvalue()


def redeem(code: str, *, event_id: int, by, now: datetime | None = None) -> Ticket:
    """Let one person in. A ticket redeems exactly once, even if two gates scan it together."""
    public_id = parse_ticket_code(code)
    ticket = (
        Ticket.objects.select_related("order", "event_seat__seat__section")
        .filter(public_id=public_id)
        .first()
    )
    if ticket is None:
        raise TicketNotFound("Ticket does not exist.")
    if ticket.order.event_id != event_id:
        raise WrongEvent("Ticket is for a different event.")

    now = now or timezone.now()
    # Compare-and-set: only the scan that flips NULL -> timestamp wins.
    won = Ticket.objects.filter(pk=ticket.pk, redeemed_at__isnull=True).update(
        redeemed_at=now, redeemed_by=by
    )
    ticket.refresh_from_db(fields=["redeemed_at", "redeemed_by"])
    if not won:
        raise AlreadyRedeemed(
            "Ticket was already used.", redeemed_at=ticket.redeemed_at.isoformat()
        )
    return ticket
