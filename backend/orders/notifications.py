import logging

from django.conf import settings
from django.core.mail import EmailMessage
from django.db import transaction

from .models import Order


logger = logging.getLogger(__name__)


def _format_order_created_email(order: Order) -> str:
    created_by_email = order.created_by.email or "N/A"
    return "\n".join(
        [
            "A new aviation fuel order has been created.",
            "",
            f"Serial No: {order.ser_no}",
            f"Date: {order.date.isoformat()}",
            f"Flight: {order.flight}",
            f"Flight Status: {order.get_flight_status_display()}",
            f"Client: {order.client.name}",
            f"Aircraft: {order.aircraft.registration_no}",
            f"Airport: {order.airport.code} - {order.airport.name}",
            f"Route: {order.route}",
            f"Fuel Type: {order.fuel_type.name}",
            f"Quantity (Ltrs): {order.quantity_ltrs}",
            f"Status: {order.get_status_display()}",
            f"Created By: {order.created_by.username}",
            f"Created By Email: {created_by_email}",
            f"Created At: {order.created_at.isoformat()}",
        ]
    )


def send_order_created_notification(order_id: int):
    recipients = list(settings.ORDER_NOTIFICATION_TO)
    if not recipients:
        logger.info("Skipping order notification for order %s because ORDER_NOTIFICATION_TO is empty.", order_id)
        return

    try:
        order = (
            Order.objects.select_related(
                "client",
                "aircraft",
                "airport",
                "fuel_type",
                "created_by",
            ).get(pk=order_id)
        )
        message = EmailMessage(
            subject=f"New Order Created: {order.ser_no}",
            body=_format_order_created_email(order),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=recipients,
            cc=list(settings.ORDER_NOTIFICATION_CC),
        )
        message.send(fail_silently=False)
    except Exception:
        logger.exception("Failed to send order creation notification for order %s.", order_id)


def schedule_order_created_notification(order_id: int):
    transaction.on_commit(lambda: send_order_created_notification(order_id))
