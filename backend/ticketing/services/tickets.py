import io
import uuid

import segno
from django.core import signing

from ticketing.errors import InvalidTicketCode
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
