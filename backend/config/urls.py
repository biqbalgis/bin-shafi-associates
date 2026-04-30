from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from aircrafts.views import AircraftViewSet
from balance_sheets.views import BalanceSheetViewSet
from clients.views import ClientViewSet
from financials.views import FinancialViewSet
from orders.views import (
    AirportViewSet,
    FlightReferenceViewSet,
    FuelCategoryViewSet,
    FuelTypeViewSet,
    OrderViewSet,
    RouteReferenceViewSet,
    SavedEmailContactViewSet,
)
from users.views import CurrentUserView, LoginView, RegisterView, UserManagementViewSet


router = DefaultRouter()
router.register("clients", ClientViewSet, basename="client")
router.register("aircrafts", AircraftViewSet, basename="aircraft")
router.register("users", UserManagementViewSet, basename="user")
router.register("orders", OrderViewSet, basename="order")
router.register("financials", FinancialViewSet, basename="financial")
router.register("balance-sheets", BalanceSheetViewSet, basename="balance-sheet")
router.register("airports", AirportViewSet, basename="airport")
router.register("fuel-types", FuelTypeViewSet, basename="fuel-type")
router.register("fuel-categories", FuelCategoryViewSet, basename="fuel-category")
router.register("flight-options", FlightReferenceViewSet, basename="flight-option")
router.register("route-options", RouteReferenceViewSet, basename="route-option")
router.register("saved-email-contacts", SavedEmailContactViewSet, basename="saved-email-contact")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/login/", LoginView.as_view(), name="login"),
    path("api/auth/register/", RegisterView.as_view(), name="register"),
    path("api/auth/me/", CurrentUserView.as_view(), name="current-user"),
    path("api/", include(router.urls)),
]
