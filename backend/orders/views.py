from django_filters import rest_framework as filters
from rest_framework import permissions, viewsets

from users.models import UserRole
from users.permissions import IsAdminRole, IsManagerOrAdminRole

from .models import Airport, FlightReference, FuelCategory, FuelType, Order, OrderStatus, RouteReference, SavedEmailContact
from .serializers import (
    AirportSerializer,
    FlightReferenceSerializer,
    FuelCategorySerializer,
    FuelTypeSerializer,
    OrderSerializer,
    RouteReferenceSerializer,
    SavedEmailContactSerializer,
)


class OrderPermission(permissions.BasePermission):
    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        role = request.user.role
        if role == UserRole.ADMIN:
            return True
        if role == UserRole.MANAGER:
            return view.action in {"list", "retrieve", "create", "update", "partial_update"}
        if role == UserRole.CUSTOMER:
            return view.action in {"list", "retrieve", "create"}
        return False


class OrderFilter(filters.FilterSet):
    date_from = filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = Order
        fields = {
            "status": ["exact"],
            "client": ["exact"],
            "aircraft": ["exact"],
            "airport": ["exact"],
            "fuel_type": ["exact"],
        }


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [OrderPermission]
    filterset_class = OrderFilter
    search_fields = ("ser_no", "flight", "route", "dr_no", "client__name", "aircraft__registration_no")
    ordering_fields = ("date", "created_at", "ser_no", "status")

    def get_queryset(self):
        queryset = Order.objects.select_related(
            "client",
            "aircraft",
            "airport",
            "fuel_type",
            "created_by",
            "financial",
        ).prefetch_related("audit_logs")
        user = self.request.user
        if user.role == UserRole.CUSTOMER:
            queryset = queryset.filter(created_by=user)
            if self.action == "list":
                scope = self.request.query_params.get("scope", "active").lower()
                if scope == "completed":
                    queryset = queryset.filter(status=OrderStatus.COMPLETED)
                elif scope == "all":
                    return queryset
                else:
                    queryset = queryset.filter(status__in=[OrderStatus.PENDING, OrderStatus.APPROVED])
            return queryset
        if self.action == "list":
            scope = self.request.query_params.get("scope", "all").lower()
            if scope == "completed":
                queryset = queryset.filter(status=OrderStatus.COMPLETED)
            elif scope == "active":
                queryset = queryset.filter(status__in=[OrderStatus.PENDING, OrderStatus.APPROVED])
        return queryset


class BaseReferenceViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ("name",)
    ordering_fields = ("name",)

    def get_permissions(self):
        if self.action == "create":
            return [permissions.IsAuthenticated()]
        if self.action in {"update", "partial_update", "destroy"}:
            return [permissions.IsAuthenticated(), IsAdminRole()]
        return [permissions.IsAuthenticated()]


class AirportViewSet(BaseReferenceViewSet):
    queryset = Airport.objects.filter(active=True)
    serializer_class = AirportSerializer
    search_fields = ("code", "name", "city", "country")
    ordering_fields = ("code", "name")


class FuelTypeViewSet(BaseReferenceViewSet):
    queryset = FuelType.objects.filter(active=True)
    serializer_class = FuelTypeSerializer


class FuelCategoryViewSet(BaseReferenceViewSet):
    queryset = FuelCategory.objects.filter(active=True)
    serializer_class = FuelCategorySerializer


class FlightReferenceViewSet(BaseReferenceViewSet):
    queryset = FlightReference.objects.filter(active=True)
    serializer_class = FlightReferenceSerializer
    search_fields = ("code", "description")
    ordering_fields = ("code",)


class RouteReferenceViewSet(BaseReferenceViewSet):
    queryset = RouteReference.objects.filter(active=True)
    serializer_class = RouteReferenceSerializer
    search_fields = ("name", "description")
    ordering_fields = ("name",)


class SavedEmailContactViewSet(viewsets.ModelViewSet):
    queryset = SavedEmailContact.objects.filter(active=True)
    serializer_class = SavedEmailContactSerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ("name", "email")
    ordering_fields = ("name", "email", "created_at")

    def get_permissions(self):
        if self.action == "create":
            return [permissions.IsAuthenticated(), IsManagerOrAdminRole()]
        if self.action in {"update", "partial_update", "destroy"}:
            return [permissions.IsAuthenticated(), IsAdminRole()]
        return [permissions.IsAuthenticated()]
