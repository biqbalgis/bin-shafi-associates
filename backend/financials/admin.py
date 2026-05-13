from django.contrib import admin

from .models import Financial


@admin.register(Financial)
class FinancialAdmin(admin.ModelAdmin):
    list_display = ("order", "dr_no", "bsa_invoice", "is_locked", "approved_at", "pso_total_price", "bsa_total_price", "profit")
    search_fields = ("order__ser_no", "dr_no", "digital_invoice", "pso_invoice", "bsa_invoice")
