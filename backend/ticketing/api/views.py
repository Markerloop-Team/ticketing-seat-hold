from django.db.models import Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ticketing.models import Event, EventSeat, Hold, Section
from ticketing.services import holds

from . import serializers as s


def _hold_queryset():
    return Hold.objects.select_related("event").prefetch_related("seats__price_group")


class EventDetail(APIView):
    def get(self, request, slug):
        event = get_object_or_404(Event.objects.select_related("venue"), slug=slug)
        available = dict(
            EventSeat.objects.filter(event=event)
            .filter(holds.claimable_q(timezone.now()))
            .values_list("seat__section_id")
            .annotate(n=Count("pk"))
        )
        sections = list(Section.objects.filter(venue=event.venue).order_by("id"))
        for section in sections:
            section.available = available.get(section.id, 0)
        return Response(s.EventSerializer(event, context={"sections": sections}).data)


class SectionSeats(APIView):
    def get(self, request, slug, section_id):
        event = get_object_or_404(Event, slug=slug)
        section = get_object_or_404(Section, pk=section_id, venue_id=event.venue_id)
        seats = (
            EventSeat.objects.filter(event=event, seat__section=section)
            .select_related("seat")
            .order_by("seat__row", "seat__number")
        )
        groups = (
            event.price_groups.filter(seats__seat__section=section).distinct().order_by("-price")
        )
        ctx = {"now": timezone.now()}
        return Response(
            {
                "section": {"id": section.id, "name": section.name},
                "price_groups": s.PriceGroupSerializer(groups, many=True).data,
                "seats": s.SeatSerializer(seats, many=True, context=ctx).data,
            }
        )


class HoldCreate(APIView):
    def post(self, request, slug):
        event = get_object_or_404(Event, slug=slug)
        payload = s.HoldRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        hold = holds.place_hold(event, payload.validated_data["seat_ids"])
        hold = _hold_queryset().get(pk=hold.pk)
        return Response(s.HoldSerializer(hold).data, status=status.HTTP_201_CREATED)


class HoldDetail(APIView):
    def get(self, request, token):
        hold = get_object_or_404(_hold_queryset(), token=token)
        return Response(s.HoldSerializer(hold).data)

    def delete(self, request, token):
        hold = get_object_or_404(Hold, token=token)
        holds.release_hold(hold)
        return Response(status=status.HTTP_204_NO_CONTENT)
