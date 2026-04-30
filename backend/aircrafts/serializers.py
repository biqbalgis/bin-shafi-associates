from rest_framework import serializers

from .models import Aircraft


class AircraftSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)

    class Meta:
        model = Aircraft
        fields = (
            "id",
            "client",
            "client_name",
            "registration_no",
            "aircraft_model",
            "manufacturer",
            "active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")
