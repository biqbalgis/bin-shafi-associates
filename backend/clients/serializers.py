from decimal import Decimal

from rest_framework import serializers

from .balances import quantize_money
from .payment_allocation import get_pending_invoices_for_client, get_total_due_for_client
from .models import Client, ClientPayment


class ClientPaymentSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)
    order_ser_no = serializers.CharField(source="order.ser_no", read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = ClientPayment
        fields = (
            "id",
            "client",
            "client_name",
            "order",
            "order_ser_no",
            "amount",
            "date",
            "payment_method",
            "reference",
            "notes",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_by", "created_by_username", "created_at", "updated_at")

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Payment amount must be greater than zero.")
        return quantize_money(value)

    def validate(self, attrs):
        client = attrs.get("client") or getattr(self.instance, "client", None)
        order = attrs.get("order") or getattr(self.instance, "order", None)

        if order and client and order.client_id != client.id:
            raise serializers.ValidationError({"order": "Selected order must belong to the selected client."})
        return attrs

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class BulkClientPaymentAllocationSerializer(serializers.Serializer):
    payment_id = serializers.IntegerField()
    order = serializers.IntegerField()
    order_ser_no = serializers.CharField()
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)


class BulkClientPaymentSerializer(serializers.Serializer):
    client = serializers.PrimaryKeyRelatedField(queryset=Client.objects.filter(is_active=True))
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    date = serializers.DateField()
    payment_method = serializers.CharField(allow_blank=True, max_length=30)
    reference = serializers.CharField(allow_blank=True, max_length=100, required=False, default="")

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Payment amount must be greater than zero.")
        return quantize_money(value)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        client = attrs["client"]
        total_due = get_total_due_for_client(client)
        if total_due <= Decimal("0.00"):
            raise serializers.ValidationError({"client": "Selected client does not have any pending invoices."})
        if attrs["amount"] > total_due:
            raise serializers.ValidationError({"amount": "Amount paid cannot be greater than the client's total due amount."})
        attrs["pending_invoices"] = get_pending_invoices_for_client(client)
        attrs["total_due"] = total_due
        return attrs


class BulkClientPaymentResponseSerializer(serializers.Serializer):
    client = serializers.IntegerField()
    total_due = serializers.DecimalField(max_digits=14, decimal_places=2)
    amount_allocated = serializers.DecimalField(max_digits=14, decimal_places=2)
    allocation_count = serializers.IntegerField()
    allocations = BulkClientPaymentAllocationSerializer(many=True)


class ClientSerializer(serializers.ModelSerializer):
    total_orders = serializers.SerializerMethodField()
    completed_orders = serializers.SerializerMethodField()
    total_billed = serializers.SerializerMethodField()
    total_paid = serializers.SerializerMethodField()
    total_due = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = (
            "id",
            "name",
            "code",
            "contact_email",
            "contact_phone",
            "address",
            "is_active",
            "total_orders",
            "completed_orders",
            "total_billed",
            "total_paid",
            "total_due",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def _get_balance_value(self, obj, field_name):
        if hasattr(obj, field_name):
            return getattr(obj, field_name)
        cache = getattr(obj, "_client_balance_cache", None)
        if cache is None:
            completed_orders = obj.orders.filter(status="COMPLETED")
            billed_orders = completed_orders.filter(financial__isnull=False).select_related("financial")
            total_billed = quantize_money(
                sum(((order.financial.bsa_total_price or Decimal("0.00")) for order in billed_orders), Decimal("0.00"))
            )
            total_paid = quantize_money(sum((payment.amount for payment in obj.payments.all()), Decimal("0.00")))
            cache = {
                "total_orders": obj.orders.count(),
                "completed_orders": completed_orders.count(),
                "total_billed": total_billed,
                "total_paid": total_paid,
                "total_due": quantize_money(total_billed - total_paid),
            }
            obj._client_balance_cache = cache
        return cache[field_name]

    def get_total_orders(self, obj):
        return self._get_balance_value(obj, "total_orders")

    def get_completed_orders(self, obj):
        return self._get_balance_value(obj, "completed_orders")

    def get_total_billed(self, obj):
        return self._get_balance_value(obj, "total_billed")

    def get_total_paid(self, obj):
        return self._get_balance_value(obj, "total_paid")

    def get_total_due(self, obj):
        return self._get_balance_value(obj, "total_due")


class ClientStatementEntrySerializer(serializers.Serializer):
    entry_type = serializers.CharField()
    date = serializers.DateField()
    order_id = serializers.IntegerField(allow_null=True)
    order_ser_no = serializers.CharField(allow_blank=True)
    dr_no = serializers.CharField(allow_blank=True)
    invoice_no = serializers.CharField(allow_blank=True)
    reference = serializers.CharField(allow_blank=True)
    notes = serializers.CharField(allow_blank=True)
    payment_method = serializers.CharField(allow_blank=True)
    billed_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    paid_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    balance_after = serializers.DecimalField(max_digits=14, decimal_places=2)


class ClientStatementPaymentSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    date = serializers.DateField()
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    payment_method = serializers.CharField(allow_blank=True)
    reference = serializers.CharField(allow_blank=True)
    notes = serializers.CharField(allow_blank=True)
    created_by_username = serializers.CharField(allow_null=True)
    created_at = serializers.DateTimeField()


class ClientInvoiceSummarySerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
    order_ser_no = serializers.CharField()
    order_date = serializers.DateField()
    completed_at = serializers.DateTimeField(allow_null=True)
    dr_no = serializers.CharField(allow_blank=True)
    invoice_no = serializers.CharField(allow_blank=True)
    invoice_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_paid = serializers.DecimalField(max_digits=14, decimal_places=2)
    due_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    payment_status = serializers.CharField()
    payment_count = serializers.IntegerField()
    last_paid_date = serializers.DateField(allow_null=True)
    payments = ClientStatementPaymentSerializer(many=True)


class ClientBalanceTotalsSerializer(serializers.Serializer):
    total_orders = serializers.IntegerField()
    completed_orders = serializers.IntegerField()
    total_billed = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_paid = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_due = serializers.DecimalField(max_digits=14, decimal_places=2)


class ClientBalanceStatementSerializer(serializers.Serializer):
    client = ClientSerializer()
    totals = ClientBalanceTotalsSerializer()
    entries = ClientStatementEntrySerializer(many=True)
    invoices = ClientInvoiceSummarySerializer(many=True)
