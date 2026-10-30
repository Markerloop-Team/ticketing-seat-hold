from django.contrib import admin

from . import models


class SectionInline(admin.TabularInline):
    model = models.Section
    extra = 0


@admin.register(models.Venue)
class VenueAdmin(admin.ModelAdmin):
    inlines = [SectionInline]


class PriceGroupInline(admin.TabularInline):
    model = models.PriceGroup
    extra = 0


@admin.register(models.Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ["title", "venue", "starts_at"]
    prepopulated_fields = {"slug": ["title"]}
    inlines = [PriceGroupInline]


@admin.register(models.EventSeat)
class EventSeatAdmin(admin.ModelAdmin):
    list_display = ["event", "seat", "price_group", "status"]
    list_filter = ["event", "status"]
    list_select_related = ["event", "seat__section", "price_group"]


@admin.register(models.Hold)
class HoldAdmin(admin.ModelAdmin):
    list_display = ["token", "event", "status", "created_at", "expires_at"]
    list_filter = ["status"]
    readonly_fields = ["token", "created_at"]


class TicketInline(admin.TabularInline):
    model = models.Ticket
    extra = 0
    readonly_fields = ["public_id", "event_seat", "price"]


@admin.register(models.Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ["token", "event", "email", "amount", "paid_at"]
    search_fields = ["email", "payment_reference"]
    inlines = [TicketInline]
