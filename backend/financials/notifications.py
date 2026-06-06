from io import BytesIO

from django.conf import settings
from django.core.mail import EmailMessage
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from .models import Financial


def _format_invoice_date(value):
    if hasattr(value, "date"):
        return value.date().isoformat()
    return value.isoformat()


def build_financial_invoice_subject(financial: Financial) -> str:
    invoice_no = financial.bsa_invoice or financial.order.ser_no
    return f"Invoice PDF: {invoice_no}"


def build_financial_invoice_body(financial: Financial) -> str:
    order = financial.order
    invoice_no = financial.bsa_invoice or order.ser_no
    invoice_date = financial.approved_at or financial.updated_at or order.date
    total_amount = financial.bsa_total_price or 0
    return "\n".join(
        [
            "Please find the attached invoice PDF.",
            "",
            f"Invoice No: {invoice_no}",
            f"Invoice Date: {_format_invoice_date(invoice_date)}",
            f"Order No: {order.ser_no}",
            f"Client: {order.client.name}",
            f"DR No: {financial.dr_no or order.dr_no or '--'}",
            f"Quantity (Ltrs): {order.quantity_ltrs}",
            f"Total Amount: {total_amount}",
            "",
            "Regards,",
            "Bin Shafi Aviation Fuel System",
        ]
    )


def build_financial_invoice_pdf(financial: Financial) -> bytes:
    order = financial.order
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    page_width, page_height = A4
    margin = 48
    y = page_height - margin

    pdf.setTitle(f"Invoice {financial.bsa_invoice or order.ser_no}")
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(margin, y, "Invoice")
    y -= 26

    pdf.setFont("Helvetica", 11)
    lines = [
        f"Invoice No: {financial.bsa_invoice or order.ser_no}",
        f"Invoice Date: {_format_invoice_date(financial.approved_at or financial.updated_at or order.date)}",
        f"Order No: {order.ser_no}",
        f"Order Date: {order.date.isoformat()}",
        f"Client: {order.client.name}",
        f"Client Code: {order.client.code}",
        f"Aircraft: {order.aircraft.registration_no}",
        f"Airport: {order.airport.code} - {order.airport.name}",
        f"Route: {order.route}",
        f"Fuel Type: {order.fuel_type.name}",
        f"DR No: {financial.dr_no or order.dr_no or '--'}",
        f"Quantity (Ltrs): {order.quantity_ltrs}",
        f"PSO Rate: {financial.pso_rate or '--'}",
        f"BSA Rate: {financial.bsa_rate or '--'}",
        f"BSA Total Price: {financial.bsa_total_price or '--'}",
        f"Profit: {financial.profit}",
    ]

    for line in lines:
        pdf.drawString(margin, y, line)
        y -= 18
        if y < margin:
            pdf.showPage()
            pdf.setFont("Helvetica", 11)
            y = page_height - margin

    pdf.save()
    return buffer.getvalue()


def send_financial_invoice_email(financial: Financial, to_email: str, subject: str, body: str):
    message = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to_email],
    )
    message.attach(
        filename=f"{financial.bsa_invoice or financial.order.ser_no}.pdf",
        content=build_financial_invoice_pdf(financial),
        mimetype="application/pdf",
    )
    message.send(fail_silently=False)
