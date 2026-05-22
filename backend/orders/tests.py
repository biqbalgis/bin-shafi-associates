from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core import mail
from rest_framework.test import APITestCase

from aircrafts.models import Aircraft
from clients.models import Client

from .models import Airport, FuelType, Order


class OrderEmailTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="manager",
            password="secret",
            role="MANAGER",
            email="manager@example.com",
        )
        self.client.force_authenticate(self.user)
        self.client_company = Client.objects.create(name="Eagle Air", code="EA")
        self.aircraft = Aircraft.objects.create(
            client=self.client_company,
            registration_no="AP-TEST",
            aircraft_model="737",
            manufacturer="Boeing",
        )
        self.airport = Airport.objects.create(code="KHI", name="Karachi")
        self.fuel_type = FuelType.objects.create(name="Jet A-1")
        self.order = Order.objects.create(
            date=date(2026, 5, 1),
            flight="PK1",
            client=self.client_company,
            aircraft=self.aircraft,
            airport=self.airport,
            route="KHI-LHE",
            fuel_type=self.fuel_type,
            quantity_ltrs=Decimal("100.00"),
            created_by=self.user,
        )

    def test_send_order_email_attaches_pdf(self):
        response = self.client.post(
            f"/api/orders/{self.order.id}/send-order-email/",
            {
                "to_email": "recipient@example.com",
                "subject": "Order PDF",
                "body": "Please see attached.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ["recipient@example.com"])
        self.assertEqual(message.subject, "Order PDF")
        self.assertEqual(len(message.attachments), 1)
        attachment = message.attachments[0]
        self.assertEqual(attachment[0], f"{self.order.ser_no}.pdf")
        self.assertEqual(attachment[2], "application/pdf")
