from rest_framework import serializers

from orders.models import OrderStatus, OrderStatusAuditLog

from .models import CompanyProfile, Financial


class CompanyProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyProfile
        fields = (
            "id",
            "company_name",
            "address",
            "phone",
            "email",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class FinancialSerializer(serializers.ModelSerializer):
    order_ser_no = serializers.CharField(source="order.ser_no", read_only=True)
    order_date = serializers.DateField(source="order.date", read_only=True)
    client = serializers.IntegerField(source="order.client_id", read_only=True)
    client_name = serializers.CharField(source="order.client.name", read_only=True)
    approved_by_name = serializers.CharField(source="approved_by.username", read_only=True)

    class Meta:
        model = Financial
        fields = (
            "id",
            "order",
            "order_ser_no",
            "order_date",
            "client",
            "client_name",
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
            "is_locked",
            "approved_at",
            "approved_by",
            "approved_by_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "order_date",
            "client",
            "client_name",
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
            "is_locked",
            "approved_at",
            "approved_by",
            "approved_by_name",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        order = attrs.get("order") or getattr(self.instance, "order", None)
        if order and order.status == OrderStatus.CANCELED:
            raise serializers.ValidationError({"order": "Financials cannot be attached to a canceled order."})
        if self.instance and self.instance.is_locked:
            raise serializers.ValidationError({"detail": "Approved invoice is locked. Unlock it from Admin Setup before editing."})
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
