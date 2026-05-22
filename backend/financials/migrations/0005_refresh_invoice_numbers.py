import re

from django.db import migrations


def build_client_invoice_prefix(client_name: str | None, client_code: str | None = None) -> str:
    compact_code = re.sub(r"[^A-Za-z0-9]", "", client_code or "").upper()
    if compact_code and len(compact_code) <= 3 and not compact_code.startswith("CL"):
        return compact_code
    words = re.findall(r"[A-Za-z0-9]+", client_name or "")
    if not words:
        return "INV"
    if len(words) == 1:
        compact = re.sub(r"[^A-Za-z0-9]", "", words[0]).upper()
        return compact[:3] or "INV"
    initials = "".join(word[0].upper() for word in words[:3])
    return initials or "INV"


def build_invoice_number(order) -> str:
    prefix = build_client_invoice_prefix(getattr(order.client, "name", ""), getattr(order.client, "code", ""))
    order_ser_no = (order.ser_no or "").strip()
    serial_match = re.fullmatch(r"ORD-(\d{8})-(\d+)", order_ser_no)
    if serial_match:
        return f"{prefix}-{serial_match.group(1)[2:]}-{int(serial_match.group(2))}"
    return f"{prefix}-{order.date:%y%m%d}-{order.id}"


def refresh_invoice_numbers(apps, schema_editor):
    Financial = apps.get_model("financials", "Financial")
    for financial in Financial.objects.select_related("order", "order__client").all():
        financial.bsa_invoice = build_invoice_number(financial.order)
        financial.save(update_fields=["bsa_invoice"])


class Migration(migrations.Migration):
    dependencies = [
        ("financials", "0004_companyprofile"),
    ]

    operations = [
        migrations.RunPython(refresh_invoice_numbers, migrations.RunPython.noop),
    ]
