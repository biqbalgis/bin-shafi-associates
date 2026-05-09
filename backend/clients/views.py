from rest_framework import permissions, response, viewsets
from rest_framework.decorators import action

from .balances import build_client_statement, with_balance_annotations
from .models import Client, ClientPayment
from .serializers import ClientBalanceStatementSerializer, ClientPaymentSerializer, ClientSerializer
from users.models import UserRole
from users.permissions import IsAdminRole, IsManagerOrAdminRole


class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    queryset = Client.objects.all()
    search_fields = ("name", "code")
    ordering_fields = ("name", "code", "created_at")

    def get_queryset(self):
        return with_balance_annotations(Client.objects.filter(is_active=True))

    def get_permissions(self):
        if self.action == "create":
            return [permissions.IsAuthenticated()]
        if self.action in {"update", "partial_update", "destroy"}:
            return [permissions.IsAuthenticated(), IsAdminRole()]
        return [permissions.IsAuthenticated()]

    @action(detail=True, methods=["get"], url_path="statement")
    def statement(self, request, pk=None):
        client = self.get_object()
        user = request.user

        if user.role == UserRole.CUSTOMER and user.client_id != client.id:
            return response.Response({"detail": "Not found."}, status=404)

        statement = build_client_statement(client)
        serializer = ClientBalanceStatementSerializer(statement)
        return response.Response(serializer.data)


class ClientPaymentViewSet(viewsets.ModelViewSet):
    serializer_class = ClientPaymentSerializer
    queryset = ClientPayment.objects.select_related("client", "order", "created_by").all()
    search_fields = ("client__name", "client__code", "order__ser_no", "reference", "notes")
    ordering_fields = ("date", "amount", "created_at", "updated_at")

    def get_queryset(self):
        queryset = ClientPayment.objects.select_related("client", "order", "created_by")
        user = self.request.user
        if user.role == UserRole.CUSTOMER:
            if not user.client_id:
                return queryset.none()
            return queryset.filter(client_id=user.client_id)
        return queryset

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [permissions.IsAuthenticated(), IsManagerOrAdminRole()]
        return [permissions.IsAuthenticated()]
