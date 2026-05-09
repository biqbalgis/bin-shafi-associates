from decimal import Decimal

from rest_framework import serializers

from clients.models import ClientPayment
from financials.models import Financial
from orders.models import Order

from .models import BalanceSheet, PsoDeposit


class PsoDepositSerializer(serializers.ModelSerializer):
    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Deposit amount must be greater than zero.")
        return value

    class Meta:
        model = PsoDeposit
        fields = ("id", "amount", "date", "cheque_number", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class BalanceSheetSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    order_ser_no = serializers.CharField(source="order.ser_no", read_only=True)
    client = serializers.IntegerField(source="order.client_id", read_only=True)
    client_name = serializers.CharField(source="order.client.name", read_only=True)
    client_payment_id = serializers.IntegerField(read_only=True)
    pso_deposits = PsoDepositSerializer(many=True, required=False)
    order = serializers.PrimaryKeyRelatedField(queryset=Order.objects.select_related("client", "financial"), required=False, allow_null=True)

    class Meta:
        model = BalanceSheet
        fields = (
            "id",
            "date",
            "order",
            "order_ser_no",
            "client",
            "client_name",
            "aviation_dr_no",
            "aviation_total_due",
            "aviation_paid",
            "aviation_balance",
            "pso_dr_no",
            "pso_deposited",
            "pso_consumed",
            "pso_balance",
            "pso_deposits",
            "created_by",
            "created_by_username",
            "client_payment_id",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "aviation_balance",
            "pso_deposited",
            "pso_balance",
            "created_by",
            "created_by_username",
            "client",
            "client_name",
            "client_payment_id",
            "created_at",
            "updated_at",
        )

    def _get_order_financial(self, order: Order) -> Financial | None:
        try:
            return order.financial
        except Financial.DoesNotExist:
            return None

    def _default_order_dr_no(self, order: Order) -> str:
        financial = self._get_order_financial(order)
        if financial and financial.dr_no:
            return financial.dr_no.strip()
        return (order.dr_no or "").strip()

    def _default_order_total_due(self, order: Order) -> Decimal:
        financial = self._get_order_financial(order)
        if not financial or financial.bsa_total_price is None:
            raise serializers.ValidationError(
                {"order": "Complete financials first so the balance sheet can track the order due amount."}
            )
        return financial.bsa_total_price

    def _sync_order_context(self, attrs):
        order = attrs.get("order") or getattr(self.instance, "order", None)
        if not order:
            return attrs

        attrs["aviation_total_due"] = self._default_order_total_due(order)
        attrs["aviation_dr_no"] = (attrs.get("aviation_dr_no") or self._default_order_dr_no(order)).strip()
        attrs["pso_dr_no"] = attrs.get("pso_dr_no", "")
        attrs["pso_consumed"] = attrs.get("pso_consumed", Decimal("0.00"))
        return attrs

    def _sync_order_dr_no(self, balance_sheet: BalanceSheet):
        if not balance_sheet.order_id:
            return

        dr_no = (balance_sheet.aviation_dr_no or "").strip()
        if dr_no and balance_sheet.order.dr_no != dr_no:
            balance_sheet.order.dr_no = dr_no
            balance_sheet.order.save(update_fields=["dr_no", "updated_at"])

        financial = self._get_order_financial(balance_sheet.order)
        if financial and dr_no and financial.dr_no != dr_no:
            Financial.objects.filter(pk=financial.pk).update(dr_no=dr_no)

    def _sync_client_payment(self, balance_sheet: BalanceSheet):
        if not balance_sheet.order_id:
            return

        amount = balance_sheet.aviation_paid or Decimal("0.00")
        payment = balance_sheet.client_payment
        if amount <= 0:
            if payment:
                payment.delete()
                balance_sheet.client_payment = None
                balance_sheet.save(update_fields=["client_payment", "updated_at"])
            return

        reference = (balance_sheet.aviation_dr_no or balance_sheet.order.dr_no or balance_sheet.order.ser_no).strip()
        defaults = {
            "client": balance_sheet.order.client,
            "order": balance_sheet.order,
            "amount": amount,
            "date": balance_sheet.date,
            "reference": reference,
            "notes": f"Balance-sheet payment for {balance_sheet.order.ser_no}",
        }

        if payment:
            for field_name, value in defaults.items():
                setattr(payment, field_name, value)
            if payment.created_by_id is None and balance_sheet.created_by_id:
                payment.created_by_id = balance_sheet.created_by_id
            payment.save()
        else:
            payment = ClientPayment.objects.create(
                **defaults,
                created_by=balance_sheet.created_by,
            )
            balance_sheet.client_payment = payment
            balance_sheet.save(update_fields=["client_payment", "updated_at"])

    def _replace_deposits(self, balance_sheet: BalanceSheet, deposits_data):
        if deposits_data is None:
            return

        balance_sheet.pso_deposits.all().delete()
        PsoDeposit.objects.bulk_create(
            [
                PsoDeposit(balance_sheet=balance_sheet, **deposit_data)
                for deposit_data in deposits_data
            ]
        )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        attrs = self._sync_order_context(attrs)
        order = attrs.get("order") or getattr(self.instance, "order", None)
        if order:
            attrs["pso_dr_no"] = ""
            attrs["pso_consumed"] = Decimal("0.00")
        return attrs

    def create(self, validated_data):
        deposits_data = validated_data.pop("pso_deposits", [])
        validated_data["created_by"] = self.context["request"].user
        validated_data["pso_deposited_manual"] = False
        balance_sheet = super().create(validated_data)
        if balance_sheet.order_id:
            self._sync_order_dr_no(balance_sheet)
            self._sync_client_payment(balance_sheet)
        else:
            self._replace_deposits(balance_sheet, deposits_data)
            BalanceSheet.rebuild_chain(start_date=balance_sheet.date)
        balance_sheet.refresh_from_db()
        return balance_sheet

    def update(self, instance, validated_data):
        deposits_data = validated_data.pop("pso_deposits", None)
        start_date = min(instance.date, validated_data.get("date", instance.date))
        validated_data["pso_deposited_manual"] = False
        balance_sheet = super().update(instance, validated_data)
        if balance_sheet.order_id:
            self._sync_order_dr_no(balance_sheet)
            self._sync_client_payment(balance_sheet)
        else:
            self._replace_deposits(balance_sheet, deposits_data)
            BalanceSheet.rebuild_chain(start_date=start_date)
        balance_sheet.refresh_from_db()
        return balance_sheet
