from rest_framework import serializers

from aircrafts.models import Aircraft
from clients.models import Client
from users.models import UserRole

from .notifications import schedule_order_created_notification
from .models import (
    Airport,
    FlightReference,
    FlightStatus,
    FuelCategory,
    FuelType,
    Order,
    OrderStatus,
    OrderStatusAuditLog,
    RouteReference,
    SavedEmailContact,
)


class AirportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Airport
        fields = ("id", "code", "name", "city", "country", "active")


class FuelTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = FuelType
        fields = ("id", "name", "description", "active")


class FuelCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = FuelCategory
        fields = ("id", "name", "description", "active")


class FlightReferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = FlightReference
        fields = ("id", "code", "description", "active")


class RouteReferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = RouteReference
        fields = ("id", "name", "description", "active")


class SavedEmailContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedEmailContact
        fields = ("id", "name", "email", "active", "created_at", "updated_at")
        read_only_fields = ("created_at", "updated_at")


class OrderStatusAuditLogSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source="changed_by.username", read_only=True)

    class Meta:
        model = OrderStatusAuditLog
        fields = (
            "id",
            "old_status",
            "new_status",
            "changed_by",
            "changed_by_name",
            "notes",
            "changed_at",
        )
        read_only_fields = ("changed_at",)


class OrderSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)
    aircraft_registration = serializers.CharField(source="aircraft.registration_no", read_only=True)
    airport_name = serializers.CharField(source="airport.name", read_only=True)
    fuel_type_name = serializers.CharField(source="fuel_type.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)
    audit_logs = OrderStatusAuditLogSerializer(many=True, read_only=True)
    financial = serializers.SerializerMethodField()
    client = serializers.PrimaryKeyRelatedField(queryset=Client.objects.filter(is_active=True), required=False)
    aircraft = serializers.PrimaryKeyRelatedField(queryset=Aircraft.objects.filter(active=True))

    class Meta:
        model = Order
        fields = (
            "id",
            "ser_no",
            "date",
            "flight",
            "flight_status",
            "client",
            "client_name",
            "aircraft",
            "aircraft_registration",
            "airport",
            "airport_name",
            "route",
            "dr_no",
            "approval_email_to",
            "approval_email_cc",
            "status",
            "fuel_type",
            "fuel_type_name",
            "quantity_ltrs",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
            "audit_logs",
            "financial",
        )
        read_only_fields = ("ser_no", "created_by", "created_at", "updated_at", "audit_logs", "financial")

    def get_financial(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated or user.role != UserRole.ADMIN:
            return None
        if not hasattr(obj, "financial"):
            return None
        from financials.serializers import FinancialSerializer

        return FinancialSerializer(obj.financial).data

    def validate(self, attrs):
        request = self.context["request"]
        user = request.user
        instance = getattr(self, "instance", None)

        if attrs.get("flight_status") and attrs["flight_status"] not in FlightStatus.values:
            raise serializers.ValidationError({"flight_status": "Select a valid flight status."})

        if "dr_no" in attrs and isinstance(attrs["dr_no"], str):
            attrs["dr_no"] = attrs["dr_no"].strip()
        for field_name in ("approval_email_to", "approval_email_cc"):
            if field_name in attrs and isinstance(attrs[field_name], str):
                attrs[field_name] = attrs[field_name].strip().lower()

        if user.role == UserRole.CUSTOMER:
            if user.client:
                if attrs.get("client") and attrs["client"].id != user.client_id:
                    raise serializers.ValidationError({"client": "Customer can only create orders for the assigned client."})
                attrs["client"] = user.client
            elif not attrs.get("client"):
                raise serializers.ValidationError({"client": "Select a client before creating an order."})
            if attrs.get("status") and attrs["status"] != OrderStatus.PENDING:
                raise serializers.ValidationError({"status": "Customer orders must start as pending."})

        if user.role == UserRole.MANAGER and not instance and attrs.get("status") and attrs["status"] != OrderStatus.PENDING:
            raise serializers.ValidationError({"status": "Manager-created orders must start as pending."})

        if user.role == UserRole.MANAGER and instance:
            disallowed_fields = set(attrs.keys()) - {"status", "dr_no", "approval_email_to", "approval_email_cc"}
            if disallowed_fields:
                raise serializers.ValidationError(
                    {"detail": "Managers can only update order status, DR number, and approval email recipients."}
                )
            if attrs.get("status") == OrderStatus.COMPLETED:
                raise serializers.ValidationError({"status": "Managers can approve orders, but completion is handled through financial closure."})

        target_status = attrs.get("status") or getattr(instance, "status", OrderStatus.PENDING)
        dr_no = attrs.get("dr_no", getattr(instance, "dr_no", ""))
        if target_status == OrderStatus.COMPLETED and not dr_no:
            raise serializers.ValidationError({"status": "DR number is required before marking an order as completed."})

        client = attrs.get("client") or getattr(instance, "client", None)
        aircraft = attrs.get("aircraft") or getattr(instance, "aircraft", None)

        if client and aircraft and aircraft.client_id != client.id:
            raise serializers.ValidationError({"aircraft": "Aircraft must belong to the selected client."})

        if attrs.get("quantity_ltrs") is not None and attrs["quantity_ltrs"] <= 0:
            raise serializers.ValidationError({"quantity_ltrs": "Quantity must be greater than zero."})

        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        user = request.user
        validated_data["created_by"] = user
        if user.role == UserRole.CUSTOMER:
            validated_data["status"] = OrderStatus.PENDING
        order = super().create(validated_data)
        OrderStatusAuditLog.objects.create(
            order=order,
            old_status="",
            new_status=order.status,
            changed_by=user,
            notes="Initial order creation.",
        )
        schedule_order_created_notification(order.id)
        return order

    def update(self, instance, validated_data):
        request = self.context["request"]
        previous_status = instance.status
        order = super().update(instance, validated_data)
        if order.status != previous_status:
            OrderStatusAuditLog.objects.create(
                order=order,
                old_status=previous_status,
                new_status=order.status,
                changed_by=request.user,
                notes="Status changed from order update.",
            )
        return order
