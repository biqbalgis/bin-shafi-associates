from django.contrib import admin

from .models import Aircraft


@admin.register(Aircraft)
class AircraftAdmin(admin.ModelAdmin):
    list_display = ("registration_no", "client", "aircraft_model", "active")
    search_fields = ("registration_no", "aircraft_model", "client__name")
    list_filter = ("active", "client")
