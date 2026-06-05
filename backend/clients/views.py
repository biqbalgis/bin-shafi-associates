from rest_framework import permissions, response, status, viewsets
from rest_framework.decorators import action

from .balances import ZERO, build_client_statement, quantize_money, with_balance_annotations
from .payment_allocation import allocate_bulk_client_payment
from .models import Client, ClientPayment
from .serializers import (
    BulkClientPaymentResponseSerializer,
    BulkClientPaymentSerializer,
    ClientBalanceStatementSerializer,
    ClientPaymentSerializer,
    ClientSerializer,
)
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
        if self.action in {"create", "update", "partial_update", "destroy", "bulk"}:
            return [permissions.IsAuthenticated(), IsManagerOrAdminRole()]
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk(self, request):
        serializer = BulkClientPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        created_payments = allocate_bulk_client_payment(
            client=serializer.validated_data["client"],
            amount=serializer.validated_data["amount"],
            date=serializer.validated_data["date"],
            payment_method=serializer.validated_data["payment_method"],
            reference=serializer.validated_data["reference"].strip(),
            created_by=request.user,
        )
        invoice_payments = [payment for payment in created_payments if payment.order_id]
        advance_amount = quantize_money(sum((payment.amount for payment in created_payments if not payment.order_id), ZERO))
        amount_allocated = quantize_money(sum((payment.amount for payment in invoice_payments), ZERO))
        response_serializer = BulkClientPaymentResponseSerializer(
            {
                "client": serializer.validated_data["client"].id,
                "total_due": serializer.validated_data["total_due"],
                "amount_allocated": amount_allocated,
                "advance_amount": advance_amount,
                "allocation_count": len(invoice_payments),
                "allocations": [
                    {
                        "payment_id": payment.id,
                        "order": payment.order_id,
                        "order_ser_no": payment.order.ser_no if payment.order_id else "",
                        "amount": payment.amount,
                    }
                    for payment in invoice_payments
                ],
            }
        )
        return response.Response(response_serializer.data, status=status.HTTP_201_CREATED)
