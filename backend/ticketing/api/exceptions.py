from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from ticketing.errors import DomainError


def exception_handler(exc, context):
    if isinstance(exc, DomainError):
        return Response({"code": exc.code, "detail": exc.detail, **exc.extra}, status=exc.status)
    return drf_exception_handler(exc, context)
