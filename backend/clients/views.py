from rest_framework import permissions, viewsets

from users.models import UserRole
from users.permissions import IsAdminRole

from .models import Client
from .serializers import ClientSerializer


class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    queryset = Client.objects.all()
    search_fields = ("name", "code")
    ordering_fields = ("name", "code", "created_at")

    def get_queryset(self):
        queryset = Client.objects.filter(is_active=True)
        return queryset

    def get_permissions(self):
        if self.action == "create":
            return [permissions.IsAuthenticated()]
        if self.action in {"update", "partial_update", "destroy"}:
            return [permissions.IsAuthenticated(), IsAdminRole()]
        return [permissions.IsAuthenticated()]
