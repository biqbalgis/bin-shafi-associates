from django.contrib import admin

from .models import BalanceSheet, PsoDeposit


class PsoDepositInline(admin.TabularInline):
    model = PsoDeposit
    extra = 0


@admin.register(BalanceSheet)
class BalanceSheetAdmin(admin.ModelAdmin):
    list_display = (
        "date",
        "aviation_dr_no",
        "aviation_total_due",
        "aviation_paid",
        "aviation_balance",
        "pso_dr_no",
        "pso_deposited",
        "pso_consumed",
        "pso_balance",
        "created_by",
    )
    search_fields = ("date", "created_by__username")
    ordering = ("-date",)
    inlines = [PsoDepositInline]
