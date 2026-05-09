from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Count, DecimalField, ExpressionWrapper, F, Min, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce

from financials.models import Financial
from orders.models import Order, OrderStatus

from .models import Client, ClientPayment


ZERO = Decimal("0.00")
MONEY_FIELD = DecimalField(max_digits=14, decimal_places=2)


def quantize_money(value: Decimal | None) -> Decimal:
    amount = value or ZERO
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def with_balance_annotations(queryset):
    billed_subquery = (
        Financial.objects.filter(order__client=OuterRef("pk"), order__status=OrderStatus.COMPLETED)
        .values("order__client")
        .annotate(total=Coalesce(Sum("bsa_total_price"), Value(ZERO, output_field=MONEY_FIELD)))
        .values("total")[:1]
    )
    paid_subquery = (
        ClientPayment.objects.filter(client=OuterRef("pk"))
        .values("client")
        .annotate(total=Coalesce(Sum("amount"), Value(ZERO, output_field=MONEY_FIELD)))
        .values("total")[:1]
    )
    return queryset.annotate(
        total_orders=Count("orders", distinct=True),
        completed_orders=Count("orders", filter=Q(orders__status=OrderStatus.COMPLETED), distinct=True),
        total_billed=Coalesce(Subquery(billed_subquery, output_field=MONEY_FIELD), Value(ZERO, output_field=MONEY_FIELD)),
        total_paid=Coalesce(Subquery(paid_subquery, output_field=MONEY_FIELD), Value(ZERO, output_field=MONEY_FIELD)),
    ).annotate(
        total_due=ExpressionWrapper(F("total_billed") - F("total_paid"), output_field=MONEY_FIELD)
    )


def get_client_totals(client: Client) -> dict[str, Decimal | int]:
    annotated_client = with_balance_annotations(Client.objects.filter(pk=client.pk)).first()
    if not annotated_client:
        return {
            "total_orders": 0,
            "completed_orders": 0,
            "total_billed": quantize_money(ZERO),
            "total_paid": quantize_money(ZERO),
            "total_due": quantize_money(ZERO),
        }
    return {
        "total_orders": annotated_client.total_orders,
        "completed_orders": annotated_client.completed_orders,
        "total_billed": quantize_money(annotated_client.total_billed),
        "total_paid": quantize_money(annotated_client.total_paid),
        "total_due": quantize_money(annotated_client.total_due),
    }


def build_client_statement(client: Client) -> dict:
    completed_orders = (
        Order.objects.filter(client=client, status=OrderStatus.COMPLETED, financial__isnull=False)
        .select_related("financial")
        .annotate(completed_at=Min("audit_logs__changed_at", filter=Q(audit_logs__new_status=OrderStatus.COMPLETED)))
        .order_by("date", "created_at")
    )
    payments = client.payments.select_related("order", "created_by").order_by("date", "created_at", "id")

    entries = []

    for order in completed_orders:
        billed_amount = quantize_money(order.financial.bsa_total_price)
        entries.append(
            {
                "entry_type": "ORDER",
                "date": order.date,
                "order_id": order.id,
                "order_ser_no": order.ser_no,
                "reference": order.dr_no or order.financial.bsa_invoice or order.ser_no,
                "notes": f"Completed order {order.ser_no}",
                "billed_amount": billed_amount,
                "paid_amount": quantize_money(ZERO),
                "_sort_created_at": order.completed_at or order.updated_at,
                "_sort_priority": 0,
                "_sort_id": order.id,
            }
        )

    for payment in payments:
        paid_amount = quantize_money(payment.amount)
        entries.append(
            {
                "entry_type": "PAYMENT",
                "date": payment.date,
                "order_id": payment.order_id,
                "order_ser_no": payment.order.ser_no if payment.order_id else "",
                "reference": payment.reference,
                "notes": payment.notes,
                "billed_amount": quantize_money(ZERO),
                "paid_amount": paid_amount,
                "_sort_created_at": payment.created_at,
                "_sort_priority": 1,
                "_sort_id": payment.id,
            }
        )

    entries.sort(key=lambda entry: (entry["date"], entry["_sort_created_at"], entry["_sort_priority"], entry["_sort_id"]))

    running_balance = quantize_money(ZERO)
    serialized_entries = []
    for entry in entries:
        running_balance = quantize_money(running_balance + entry["billed_amount"] - entry["paid_amount"])
        serialized_entries.append(
            {
                "entry_type": entry["entry_type"],
                "date": entry["date"],
                "order_id": entry["order_id"],
                "order_ser_no": entry["order_ser_no"],
                "reference": entry["reference"],
                "notes": entry["notes"],
                "billed_amount": entry["billed_amount"],
                "paid_amount": entry["paid_amount"],
                "balance_after": running_balance,
            }
        )

    return {
        "client": client,
        "totals": get_client_totals(client),
        "entries": serialized_entries,
    }
