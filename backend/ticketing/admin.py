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
