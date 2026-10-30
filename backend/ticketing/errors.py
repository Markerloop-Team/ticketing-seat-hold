class DomainError(Exception):
    """Business rule violation. The API layer maps `code` and `status` to a response."""

    code = "domain_error"
    status = 400

    def __init__(self, detail: str = "", **extra):
        super().__init__(detail or self.code)
        self.detail = detail or self.code
        self.extra = extra


class HoldLimitExceeded(DomainError):
    code = "hold_limit_exceeded"


class SeatsUnavailable(DomainError):
    code = "seats_unavailable"
    status = 409


class HoldNotActive(DomainError):
    code = "hold_not_active"
    status = 409


class PaymentReferenceConflict(DomainError):
    code = "payment_reference_conflict"
    status = 409


class InvalidTicketCode(DomainError):
    code = "invalid_ticket_code"


class TicketNotFound(DomainError):
    code = "ticket_not_found"
    status = 404


class WrongEvent(DomainError):
    code = "wrong_event"
    status = 409


class AlreadyRedeemed(DomainError):
    code = "already_redeemed"
    status = 409
