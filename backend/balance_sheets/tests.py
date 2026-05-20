from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from aircrafts.models import Aircraft
from clients.balances import with_balance_annotations
from clients.models import Client
from financials.models import Financial
from orders.models import Airport, FuelType, Order, OrderStatus, OrderStatusAuditLog

from .models import BalanceSheet
from .serializers import BalanceSheetSerializer


class OrderLinkedBalanceSheetTests(TestCase):
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
        self.request = APIRequestFactory().post("/api/balance-sheets/")
        self.request.user = self.user

    def _create_completed_order(self, serial_suffix: int, total_amount: Decimal, pso_total_amount: Decimal | None = None) -> Order:
        order = Order.objects.create(
            date=date(2026, 5, serial_suffix),
            flight=f"PK{serial_suffix}",
            client=self.client,
            aircraft=self.aircraft,
            airport=self.airport,
            route="KHI-LHE",
            dr_no=f"DR-{serial_suffix}",
            status=OrderStatus.COMPLETED,
            fuel_type=self.fuel_type,
            quantity_ltrs=Decimal("100.00"),
            created_by=self.user,
        )
        OrderStatusAuditLog.objects.create(
            order=order,
            old_status=OrderStatus.APPROVED,
            new_status=OrderStatus.COMPLETED,
            changed_by=self.user,
            notes="Completed in test setup.",
        )
        financial = Financial.objects.create(
            order=order,
            dr_no=order.dr_no,
            pso_rate=Decimal("1.00"),
            bsa_rate=Decimal("1.00"),
        )
        updates = {"bsa_total_price": total_amount}
        if pso_total_amount is not None:
            updates["pso_total_price"] = pso_total_amount
        Financial.objects.filter(pk=financial.pk).update(**updates)
        financial.refresh_from_db()
        return order

    def test_order_balance_sheet_syncs_payment_and_updates_client_totals(self):
        first_order = self._create_completed_order(1, Decimal("100.00"))
        second_order = self._create_completed_order(2, Decimal("100.00"))

        for order, paid in ((first_order, "100.00"), (second_order, "50.00")):
            serializer = BalanceSheetSerializer(
                data={
                    "order": order.id,
                    "date": "2026-05-09",
                    "aviation_dr_no": order.dr_no,
                    "aviation_paid": paid,
                    "payment_method": "ACCOUNT_TRANSFER" if order == first_order else "CHEQUE",
                    "payment_reference": f"PAY-{order.id}",
                    "payment_notes": f"Payment received for {order.ser_no}",
                    "pso_consumed": "0",
                    "pso_deposits": [],
                },
                context={"request": self.request},
            )
            self.assertTrue(serializer.is_valid(), serializer.errors)
            serializer.save()

        annotated_client = with_balance_annotations(Client.objects.all()).get(pk=self.client.pk)
        self.assertEqual(annotated_client.total_billed, Decimal("200.00"))
        self.assertEqual(annotated_client.total_paid, Decimal("150.00"))
        self.assertEqual(annotated_client.total_due, Decimal("50.00"))

        first_order.refresh_from_db()
        second_order.refresh_from_db()
        self.assertEqual(first_order.balance_sheet.aviation_total_due, Decimal("100.00"))
        self.assertEqual(second_order.balance_sheet.aviation_paid, Decimal("50.00"))
        self.assertEqual(second_order.balance_sheet.client_payment.amount, Decimal("50.00"))
        self.assertEqual(first_order.balance_sheet.client_payment.payment_method, "ACCOUNT_TRANSFER")
        self.assertEqual(second_order.balance_sheet.client_payment.reference, f"PAY-{second_order.id}")

    def test_daily_pso_summary_uses_deposits_and_completed_invoice_totals(self):
        self._create_completed_order(1, Decimal("100.00"), pso_total_amount=Decimal("120.00"))
        self._create_completed_order(2, Decimal("100.00"), pso_total_amount=Decimal("80.00"))

        serializer = BalanceSheetSerializer(
            data={
                "date": "2026-05-09",
                "aviation_dr_no": "",
                "aviation_paid": "0",
                "pso_dr_no": "PSO-1",
                "pso_deposits": [
                    {
                        "amount": "1000.00",
                        "date": "2026-05-09",
                        "mode": "ACCOUNT_TRANSFER",
                        "reference": "DEP-1000",
                    }
                ],
            },
            context={"request": self.request},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        record = serializer.save()

        record.refresh_from_db()
        self.assertEqual(record.pso_deposited, Decimal("1000.00"))
        self.assertEqual(record.pso_consumed, Decimal("200.00"))
        self.assertEqual(record.pso_balance, Decimal("800.00"))

        summary = BalanceSheet.get_pso_summary(date(2026, 5, 9))
        self.assertEqual(summary["deposited"], Decimal("1000.00"))
        self.assertEqual(summary["consumed"], Decimal("200.00"))
        self.assertEqual(summary["balance"], Decimal("800.00"))
