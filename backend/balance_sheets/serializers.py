from rest_framework import serializers

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
    pso_deposits = PsoDepositSerializer(many=True, required=False)

    class Meta:
        model = BalanceSheet
        fields = (
            "id",
            "date",
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
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "aviation_balance",
            "pso_deposited",
            "pso_balance",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        )

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

    def create(self, validated_data):
        deposits_data = validated_data.pop("pso_deposits", [])
        validated_data["created_by"] = self.context["request"].user
        validated_data["pso_deposited_manual"] = False
        balance_sheet = super().create(validated_data)
        self._replace_deposits(balance_sheet, deposits_data)
        BalanceSheet.rebuild_chain(start_date=balance_sheet.date)
        balance_sheet.refresh_from_db()
        return balance_sheet

    def update(self, instance, validated_data):
        deposits_data = validated_data.pop("pso_deposits", None)
        start_date = min(instance.date, validated_data.get("date", instance.date))
        validated_data["pso_deposited_manual"] = False
        balance_sheet = super().update(instance, validated_data)
        self._replace_deposits(balance_sheet, deposits_data)
        BalanceSheet.rebuild_chain(start_date=start_date)
        balance_sheet.refresh_from_db()
        return balance_sheet
