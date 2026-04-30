from rest_framework import viewsets

from users.permissions import IsAdminRole

from .models import Financial
from .serializers import FinancialSerializer


class FinancialViewSet(viewsets.ModelViewSet):
    queryset = Financial.objects.select_related("order").all()
    serializer_class = FinancialSerializer
    permission_classes = [IsAdminRole]
    search_fields = ("order__ser_no", "dr_no", "digital_invoice", "pso_invoice", "bsa_invoice")
    ordering_fields = ("created_at", "updated_at", "profit")
