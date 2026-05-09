from django.contrib import admin

from .models import Client, ClientPayment


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "contact_email", "is_active")
    search_fields = ("name", "code", "contact_email")
    list_filter = ("is_active",)


@admin.register(ClientPayment)
class ClientPaymentAdmin(admin.ModelAdmin):
    list_display = ("client", "order", "amount", "date", "reference", "created_by")
    search_fields = ("client__name", "client__code", "order__ser_no", "reference")
    list_filter = ("date", "client")
