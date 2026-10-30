import logging

from celery import shared_task

from ticketing.services.holds import expire_holds

log = logging.getLogger(__name__)


@shared_task
def release_expired_holds() -> int:
    total = 0
    while released := expire_holds():
        total += released
    if total:
        log.info("released %d expired holds", total)
    return total
