from django_filters import rest_framework as filters
from rest_framework import response, status, viewsets
from rest_framework.decorators import action

from users.permissions import IsAdminRole

from .models import BalanceSheet
from .serializers import BalanceSheetSerializer, PsoSummarySerializer


class BalanceSheetFilter(filters.FilterSet):
    date_from = filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = filters.DateFilter(field_name="date", lookup_expr="lte")
    order = filters.NumberFilter(field_name="order_id")
    record_type = filters.CharFilter(method="filter_record_type")

    class Meta:
        model = BalanceSheet
        fields = {
            "date": ["exact"],
            "order": ["exact"],
        }

    def filter_record_type(self, queryset, _name, value):
        normalized = (value or "").strip().lower()
        if normalized == "order":
            return queryset.filter(order__isnull=False)
        if normalized == "daily":
            return queryset.filter(order__isnull=True)
        return queryset


class BalanceSheetViewSet(viewsets.ModelViewSet):
    queryset = (
        BalanceSheet.objects.select_related("created_by", "order", "order__client", "client_payment")
        .prefetch_related("pso_deposits")
        .all()
    )
    serializer_class = BalanceSheetSerializer
    permission_classes = [IsAdminRole]
    filterset_class = BalanceSheetFilter
    search_fields = ("created_by__username", "order__ser_no", "order__client__name", "aviation_dr_no", "pso_dr_no")
    ordering_fields = ("date", "created_at", "updated_at")

    @action(detail=False, methods=["get"], url_path="pso-summary")
    def pso_summary(self, request):
        raw_date = (request.query_params.get("date") or "").strip()
        if not raw_date:
            return response.Response({"date": "This query parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            summary_date = PsoSummarySerializer().fields["date"].to_internal_value(raw_date)
        except Exception:
            return response.Response({"date": "Enter a valid date."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = PsoSummarySerializer(BalanceSheet.get_pso_summary(summary_date))
        return response.Response(serializer.data)
