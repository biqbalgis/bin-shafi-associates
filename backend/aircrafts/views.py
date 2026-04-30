from rest_framework import permissions, viewsets

from users.models import UserRole
from users.permissions import IsAdminRole

from .models import Aircraft
from .serializers import AircraftSerializer


class AircraftViewSet(viewsets.ModelViewSet):
    serializer_class = AircraftSerializer
    search_fields = ("registration_no", "aircraft_model", "client__name")
    ordering_fields = ("registration_no", "created_at")

    def get_queryset(self):
        queryset = Aircraft.objects.select_related("client").filter(active=True)
        user = self.request.user
        client_id = self.request.query_params.get("client")
        if user.role == UserRole.CUSTOMER:
            if user.client_id:
                queryset = queryset.filter(client_id=user.client_id)
            elif client_id:
                queryset = queryset.filter(client_id=client_id)
            else:
                return queryset.none()
        elif client_id:
            queryset = queryset.filter(client_id=client_id)
        return queryset

    def get_permissions(self):
        if self.action == "create":
            return [permissions.IsAuthenticated()]
        if self.action in {"update", "partial_update", "destroy"}:
            return [permissions.IsAuthenticated(), IsAdminRole()]
        return [permissions.IsAuthenticated()]
