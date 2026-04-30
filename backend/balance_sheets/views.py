from django_filters import rest_framework as filters
from rest_framework import viewsets

from users.permissions import IsAdminRole

from .models import BalanceSheet
from .serializers import BalanceSheetSerializer


class BalanceSheetFilter(filters.FilterSet):
    date_from = filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = BalanceSheet
        fields = {
            "date": ["exact"],
        }


class BalanceSheetViewSet(viewsets.ModelViewSet):
    queryset = BalanceSheet.objects.select_related("created_by").all()
    serializer_class = BalanceSheetSerializer
    permission_classes = [IsAdminRole]
    filterset_class = BalanceSheetFilter
    search_fields = ("created_by__username",)
    ordering_fields = ("date", "created_at", "updated_at")
