from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from aircrafts.models import Aircraft
from clients.models import Client
from orders.models import Airport, FuelType, Order

from .models import CompanyProfile, Financial


class FinancialCalculationTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(username="admin", password="secret", role="ADMIN")
        self.client = Client.objects.create(name="Client A", code="CL-A")
        self.aircraft = Aircraft.objects.create(
            client=self.client,
            registration_no="AP-TEST",
            aircraft_model="737",
            manufacturer="Boeing",
        )
        self.airport = Airport.objects.create(code="KHI", name="Karachi")
        self.fuel_type = FuelType.objects.create(name="Jet A-1")

    def test_totals_include_fueling_charges_and_gst_for_pso_and_bsa(self):
        order = Order.objects.create(
            date=date(2026, 5, 1),
            flight="PK1",
            client=self.client,
            aircraft=self.aircraft,
            airport=self.airport,
            route="KHI-LHE",
            fuel_type=self.fuel_type,
            quantity_ltrs=Decimal("100.00"),
            created_by=self.user,
        )

        financial = Financial.objects.create(
            order=order,
            dr_no="DR-1",
            pso_rate=Decimal("10.00"),
            bsa_rate=Decimal("12.00"),
        )

        self.assertEqual(financial.pso_price, Decimal("1000.00"))
        self.assertEqual(financial.pso_gst, Decimal("180.00"))
        self.assertEqual(financial.pso_total_price, Decimal("6280.00"))
        self.assertEqual(financial.bsa_price, Decimal("1200.00"))
        self.assertEqual(financial.bsa_gst, Decimal("216.00"))
        self.assertEqual(financial.bsa_total_price, Decimal("6516.00"))

    def test_invoice_number_uses_client_prefix_date_and_sequence(self):
        self.client.name = "Eagle Air"
        self.client.save(update_fields=["name"])
        order = Order.objects.create(
            date=date(2026, 5, 1),
            flight="PK2",
            client=self.client,
            aircraft=self.aircraft,
            airport=self.airport,
            route="KHI-LHE",
            fuel_type=self.fuel_type,
            quantity_ltrs=Decimal("100.00"),
            created_by=self.user,
        )

        financial = Financial.objects.create(
            order=order,
            dr_no="DR-2",
            pso_rate=Decimal("10.00"),
            bsa_rate=Decimal("12.00"),
        )

        self.assertEqual(financial.bsa_invoice, "EA-260501-1")


class CompanyProfileTests(TestCase):
    def test_company_profile_can_be_created_with_blank_defaults(self):
        profile = CompanyProfile.objects.create()

        self.assertEqual(profile.company_name, "")
        self.assertEqual(profile.address, "")
        self.assertEqual(profile.phone, "")
        self.assertEqual(profile.email, "")
