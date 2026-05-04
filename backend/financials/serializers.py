from rest_framework import serializers

from orders.models import OrderStatus, OrderStatusAuditLog

from .models import Financial


class FinancialSerializer(serializers.ModelSerializer):
    order_ser_no = serializers.CharField(source="order.ser_no", read_only=True)

    class Meta:
        model = Financial
        fields = (
            "id",
            "order",
            "order_ser_no",
            "dr_no",
            "digital_invoice",
            "pso_invoice",
            "pso_rate",
            "pso_price",
            "fueling_charges",
            "pso_gst",
            "pso_total_price",
            "bsa_invoice",
            "bsa_rate",
            "bsa_price",
            "bsa_fueling_charges",
            "bsa_gst",
            "bsa_total_price",
            "profit",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "pso_price",
            "fueling_charges",
            "bsa_invoice",
            "bsa_price",
            "bsa_fueling_charges",
            "pso_gst",
            "pso_total_price",
            "bsa_gst",
            "bsa_total_price",
            "profit",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        order = attrs.get("order") or getattr(self.instance, "order", None)
        if order and order.status == OrderStatus.CANCELED:
            raise serializers.ValidationError({"order": "Financials cannot be attached to a canceled order."})
        return attrs

    def _sync_order_dr_no(self, financial: Financial):
        dr_no = (financial.dr_no or "").strip()
        if dr_no and financial.order.dr_no != dr_no:
            financial.order.dr_no = dr_no
            financial.order.save(update_fields=["dr_no", "updated_at"])

    def _sync_order_status(self, financial: Financial):
        request = self.context["request"]
        order = financial.order
        previous_status = order.status
        if order.status == OrderStatus.CANCELED:
            return

        if financial.is_financially_complete():
            target_status = OrderStatus.COMPLETED
        elif previous_status == OrderStatus.COMPLETED:
            target_status = OrderStatus.APPROVED
        else:
            return

        if previous_status != target_status:
            order.status = target_status
            order.save(update_fields=["status", "updated_at"])
            OrderStatusAuditLog.objects.create(
                order=order,
                old_status=previous_status,
                new_status=target_status,
                changed_by=request.user,
                notes="Status updated from financial workflow.",
            )

    def create(self, validated_data):
        financial = super().create(validated_data)
        self._sync_order_dr_no(financial)
        self._sync_order_status(financial)
        return financial

    def update(self, instance, validated_data):
        financial = super().update(instance, validated_data)
        self._sync_order_dr_no(financial)
        self._sync_order_status(financial)
        return financial
