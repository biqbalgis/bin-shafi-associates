from django.contrib import admin

from .models import (
    Airport,
    FlightReference,
    FuelCategory,
    FuelType,
    Order,
    OrderStatusAuditLog,
    RouteReference,
    SavedEmailContact,
)


@admin.register(Airport)
class AirportAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "city", "country", "active")
    search_fields = ("code", "name", "city", "country")
    list_filter = ("active", "country")


@admin.register(FuelType)
class FuelTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "active")
    search_fields = ("name",)
    list_filter = ("active",)


@admin.register(FuelCategory)
class FuelCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "active")
    search_fields = ("name",)
    list_filter = ("active",)


@admin.register(FlightReference)
class FlightReferenceAdmin(admin.ModelAdmin):
    list_display = ("code", "description", "active")
    search_fields = ("code", "description")
    list_filter = ("active",)


@admin.register(RouteReference)
class RouteReferenceAdmin(admin.ModelAdmin):
    list_display = ("name", "description", "active")
    search_fields = ("name", "description")
    list_filter = ("active",)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "ser_no",
        "date",
        "flight",
        "flight_status",
        "dr_no",
        "client",
        "airport",
        "status",
        "approval_email_to",
        "approval_email_cc",
        "quantity_ltrs",
    )
    search_fields = ("ser_no", "flight", "route", "dr_no", "client__name", "aircraft__registration_no")
    list_filter = ("status", "flight_status", "client", "airport", "fuel_type")


@admin.register(OrderStatusAuditLog)
class OrderStatusAuditLogAdmin(admin.ModelAdmin):
    list_display = ("order", "old_status", "new_status", "changed_by", "changed_at")
    search_fields = ("order__ser_no", "changed_by__username")
    list_filter = ("new_status",)


@admin.register(SavedEmailContact)
class SavedEmailContactAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "active")
    search_fields = ("name", "email")
    list_filter = ("active",)
