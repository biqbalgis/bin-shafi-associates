from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from aircrafts.models import Aircraft
from financials.models import Financial
from orders.models import Airport, FuelType, Order, OrderStatus, OrderStatusAuditLog

from .balances import build_client_statement, with_balance_annotations
from .models import Client, ClientPayment
from .payment_allocation import allocate_bulk_client_payment, get_total_due_for_client


class ClientBalanceTests(TestCase):
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

    def _create_completed_order(self, serial_suffix: int, order_date: date, total_amount: Decimal) -> Order:
        order = Order.objects.create(
            date=order_date,
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
        Financial.objects.filter(pk=financial.pk).update(bsa_total_price=total_amount)
        financial.refresh_from_db()
        return order

    def test_client_balance_totals_and_statement_follow_completed_orders_and_payments(self):
        first_order = self._create_completed_order(1, date(2026, 5, 1), Decimal("1000.00"))
        second_order = self._create_completed_order(2, date(2026, 5, 2), Decimal("1000.00"))
        third_order = self._create_completed_order(3, date(2026, 5, 3), Decimal("1000.00"))

        ClientPayment.objects.create(
            client=self.client,
            amount=Decimal("1000.00"),
            date=date(2026, 5, 2),
            payment_method="ACCOUNT_TRANSFER",
            reference="PAY-1",
            created_by=self.user,
        )
        ClientPayment.objects.create(
            client=self.client,
            order=third_order,
            amount=Decimal("500.00"),
            date=date(2026, 5, 4),
            payment_method="CHEQUE",
            reference="PAY-2",
            created_by=self.user,
        )

        annotated_client = with_balance_annotations(Client.objects.all()).get(pk=self.client.pk)
        statement = build_client_statement(annotated_client)

        self.assertEqual(statement["totals"]["total_orders"], 3)
        self.assertEqual(statement["totals"]["completed_orders"], 3)
        self.assertEqual(statement["totals"]["previously_billed"], Decimal("2000.00"))
        self.assertEqual(statement["totals"]["current_billed"], Decimal("1000.00"))
        self.assertEqual(statement["totals"]["total_billed"], Decimal("3000.00"))
        self.assertEqual(statement["totals"]["total_paid"], Decimal("1500.00"))
        self.assertEqual(statement["totals"]["total_due"], Decimal("1500.00"))
        self.assertEqual(len(statement["entries"]), 5)
        self.assertEqual(statement["entries"][-1]["balance_after"], Decimal("1500.00"))
        self.assertEqual(statement["entries"][0]["order_id"], first_order.id)
        self.assertEqual(statement["entries"][1]["order_id"], second_order.id)
        self.assertEqual(len(statement["invoices"]), 3)
        self.assertEqual(statement["invoices"][0]["payment_status"], "UNPAID")
        self.assertEqual(statement["invoices"][2]["payment_status"], "PARTIALLY_PAID")
        self.assertEqual(statement["invoices"][2]["payments"][0]["payment_method"], "CHEQUE")

    def test_bulk_payment_allocates_to_oldest_pending_invoices(self):
        first_order = self._create_completed_order(1, date(2026, 5, 1), Decimal("10.00"))
        second_order = self._create_completed_order(2, date(2026, 5, 2), Decimal("10.00"))
        third_order = self._create_completed_order(3, date(2026, 5, 3), Decimal("10.00"))
        fourth_order = self._create_completed_order(4, date(2026, 5, 4), Decimal("10.00"))
        fifth_order = self._create_completed_order(5, date(2026, 5, 5), Decimal("10.00"))
        sixth_order = self._create_completed_order(6, date(2026, 5, 6), Decimal("10.00"))

        payments = allocate_bulk_client_payment(
            client=self.client,
            amount=Decimal("55.00"),
            date=date(2026, 5, 10),
            payment_method="ACCOUNT_TRANSFER",
            reference="BULK-55",
            created_by=self.user,
        )

        self.assertEqual(len(payments), 6)
        self.assertEqual([payment.order_id for payment in payments[:5]], [first_order.id, second_order.id, third_order.id, fourth_order.id, fifth_order.id])
        self.assertEqual(payments[5].order_id, sixth_order.id)
        self.assertEqual(payments[5].amount, Decimal("5.00"))

        statement = build_client_statement(self.client)
        self.assertEqual(statement["invoices"][0]["payment_status"], "PAID")
        self.assertEqual(statement["invoices"][1]["payment_status"], "PAID")
        self.assertEqual(statement["invoices"][2]["payment_status"], "PAID")
        self.assertEqual(statement["invoices"][3]["payment_status"], "PAID")
        self.assertEqual(statement["invoices"][4]["payment_status"], "PAID")
        self.assertEqual(statement["invoices"][5]["payment_status"], "PARTIALLY_PAID")
        self.assertEqual(statement["invoices"][5]["due_amount"], Decimal("5.00"))

    def test_bulk_payment_total_due_matches_remaining_invoice_amount(self):
        self._create_completed_order(1, date(2026, 5, 1), Decimal("10.00"))
        second_order = self._create_completed_order(2, date(2026, 5, 2), Decimal("10.00"))

        ClientPayment.objects.create(
            client=self.client,
            order=second_order,
            amount=Decimal("4.00"),
            date=date(2026, 5, 3),
            payment_method="CHEQUE",
            reference="PARTIAL-2",
            created_by=self.user,
        )

        self.assertEqual(get_total_due_for_client(self.client), Decimal("16.00"))
