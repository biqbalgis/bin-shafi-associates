from rest_framework import serializers

from .models import BalanceSheet


class BalanceSheetSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = BalanceSheet
        fields = (
            "id",
            "date",
            "aviation_total_due",
            "aviation_paid",
            "aviation_balance",
            "pso_deposited",
            "pso_consumed",
            "pso_balance",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "aviation_balance",
            "pso_balance",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        )

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)
