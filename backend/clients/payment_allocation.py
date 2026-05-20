from decimal import Decimal

from django.db import transaction
from django.db.models import Min, Q

from orders.models import Order, OrderStatus

from .balances import ZERO, quantize_money
from .models import Client, ClientPayment


def get_pending_invoices_for_client(client: Client) -> list[dict]:
    completed_orders = (
        Order.objects.filter(client=client, status=OrderStatus.COMPLETED, financial__isnull=False)
        .select_related("financial")
        .prefetch_related("client_payments")
        .annotate(completed_at=Min("audit_logs__changed_at", filter=Q(audit_logs__new_status=OrderStatus.COMPLETED)))
        .order_by("completed_at", "date", "created_at", "id")
    )

    invoices: list[dict] = []
    for order in completed_orders:
        invoice_amount = quantize_money(order.financial.bsa_total_price)
        total_paid = quantize_money(sum((payment.amount for payment in order.client_payments.all()), ZERO))
        due_amount = quantize_money(invoice_amount - total_paid)
        if due_amount <= ZERO:
            continue
        invoices.append(
            {
                "order": order,
                "due_amount": due_amount,
            }
        )
    return invoices


def get_total_due_for_client(client: Client) -> Decimal:
    pending_invoices = get_pending_invoices_for_client(client)
    return quantize_money(sum((invoice["due_amount"] for invoice in pending_invoices), ZERO))


@transaction.atomic
def allocate_bulk_client_payment(
    *,
    client: Client,
    amount: Decimal,
    date,
    payment_method: str,
    reference: str,
    created_by,
) -> list[ClientPayment]:
    remaining_amount = quantize_money(amount)
    pending_invoices = get_pending_invoices_for_client(client)
    created_payments: list[ClientPayment] = []

    for invoice in pending_invoices:
        if remaining_amount <= ZERO:
            break
        allocated_amount = min(invoice["due_amount"], remaining_amount)
        created_payments.append(
            ClientPayment.objects.create(
                client=client,
                order=invoice["order"],
                amount=allocated_amount,
                date=date,
                payment_method=payment_method,
                reference=reference,
                notes="",
                created_by=created_by,
            )
        )
        remaining_amount = quantize_money(remaining_amount - allocated_amount)

    return created_payments
