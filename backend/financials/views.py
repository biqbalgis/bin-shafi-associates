from django_filters import rest_framework as filters
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response

from users.permissions import IsAdminRole

from .models import CompanyProfile, Financial
from .serializers import CompanyProfileSerializer, FinancialSerializer


class FinancialFilter(filters.FilterSet):
    client = filters.NumberFilter(field_name="order__client_id")
    date_from = filters.DateFilter(field_name="order__date", lookup_expr="gte")
    date_to = filters.DateFilter(field_name="order__date", lookup_expr="lte")
    is_locked = filters.BooleanFilter()

    class Meta:
        model = Financial
        fields = ("client", "is_locked")


class FinancialViewSet(viewsets.ModelViewSet):
    queryset = Financial.objects.select_related("order", "order__client", "approved_by").all()
    serializer_class = FinancialSerializer
    permission_classes = [IsAdminRole]
    filterset_class = FinancialFilter
    search_fields = ("order__ser_no", "order__client__name", "dr_no", "digital_invoice", "pso_invoice", "bsa_invoice")
    ordering_fields = ("order__date", "created_at", "updated_at", "profit", "bsa_total_price", "approved_at", "id")

    def get_queryset(self):
        return super().get_queryset().order_by("-order__date", "-approved_at", "-updated_at", "-created_at", "-id")

    @action(detail=True, methods=["post"], url_path="approve-invoice")
    def approve_invoice(self, request, pk=None):
        financial = self.get_object()
        if financial.is_locked:
            return Response({"detail": "Invoice is already approved."}, status=status.HTTP_400_BAD_REQUEST)
        if not financial.is_financially_complete():
            return Response(
                {"detail": "Complete DR number and invoice pricing before approving the invoice."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        financial.approve(request.user)
        serializer = self.get_serializer(financial)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="unlock-invoice")
    def unlock_invoice(self, request, pk=None):
        financial = self.get_object()
        if not financial.is_locked:
            return Response({"detail": "Invoice is already editable."}, status=status.HTTP_400_BAD_REQUEST)
        financial.unlock_for_editing()
        serializer = self.get_serializer(financial)
        return Response(serializer.data)


class CompanyProfileView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAdminRole()]

    def get_object(self):
        profile = CompanyProfile.objects.order_by("id").first()
        if profile:
            return profile
        return CompanyProfile.objects.create()

    def get(self, request):
        serializer = CompanyProfileSerializer(self.get_object())
        return Response(serializer.data)

    def put(self, request):
        serializer = CompanyProfileSerializer(self.get_object(), data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def patch(self, request):
        serializer = CompanyProfileSerializer(self.get_object(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
