from django.contrib import admin

from .models import BalanceSheet


@admin.register(BalanceSheet)
class BalanceSheetAdmin(admin.ModelAdmin):
    list_display = (
        "date",
        "aviation_total_due",
        "aviation_paid",
        "aviation_balance",
        "pso_deposited",
        "pso_consumed",
        "pso_balance",
        "created_by",
    )
    search_fields = ("date", "created_by__username")
    ordering = ("-date",)
