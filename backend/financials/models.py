from decimal import Decimal, ROUND_HALF_UP

from django.db import models
from django.utils import timezone


class CompanyProfile(models.Model):
    company_name = models.CharField(max_length=255, blank=True)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("id",)

    def __str__(self) -> str:
        return self.company_name or "Company Profile"


class Financial(models.Model):
    GST_RATE = Decimal("0.18")
    FIXED_FUELING_CHARGES = Decimal("5100.00")
    order = models.OneToOneField("orders.Order", on_delete=models.CASCADE, related_name="financial")
    dr_no = models.CharField(max_length=100, blank=True)
    digital_invoice = models.CharField(max_length=100, blank=True)
    pso_invoice = models.CharField(max_length=100, blank=True)
    pso_rate = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    pso_price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    fueling_charges = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    pso_gst = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    pso_total_price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    bsa_invoice = models.CharField(max_length=100, blank=True)
    bsa_rate = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    bsa_price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    bsa_fueling_charges = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    bsa_gst = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    bsa_total_price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    profit = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    is_locked = models.BooleanField(default=False)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_financials",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at",)

    def __str__(self) -> str:
        return f"Financials for {self.order.ser_no}"

    def calculate_profit(self) -> Decimal:
        bsa_price = self.bsa_price or Decimal("0.00")
        pso_price = self.pso_price or Decimal("0.00")
        return bsa_price - pso_price

    def _quantize(self, value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def _calculate_price(self, rate: Decimal | None) -> Decimal | None:
        if rate is None:
            return None
        quantity = self.order.quantity_ltrs if self.order_id else None
        if quantity is None:
            return None
        return self._quantize(rate * quantity)

    def _calculate_gst(self, price: Decimal | None) -> Decimal | None:
        if price is None:
            return None
        return self._quantize(price * self.GST_RATE)

    def _calculate_total(
        self,
        price: Decimal | None,
        fueling_charges: Decimal | None,
        gst: Decimal | None,
    ) -> Decimal | None:
        if price is None and fueling_charges is None and gst is None:
            return None
        subtotal = (
            (price or Decimal("0.00"))
            + (fueling_charges or Decimal("0.00"))
            + (gst or Decimal("0.00"))
        )
        return self._quantize(subtotal)

    def _generate_bsa_invoice(self) -> str:
        order_ser_no = (self.order.ser_no or "").strip()
        if order_ser_no.startswith("ORD-"):
            return f"BSA-{order_ser_no[4:]}"
        if order_ser_no:
            return f"BSA-{order_ser_no}"
        return f"BSA-{self.order_id}"

    def is_financially_complete(self) -> bool:
        dr_no = self.order.dr_no or self.dr_no
        required_values = [
            dr_no,
            self.pso_total_price,
            self.bsa_total_price,
            self.pso_rate,
            self.bsa_rate,
        ]
        return all(value not in (None, "") for value in required_values)

    def approve(self, user):
        self.is_locked = True
        self.approved_at = timezone.now()
        self.approved_by = user
        self.save(update_fields=["is_locked", "approved_at", "approved_by", "updated_at"])

    def unlock_for_editing(self):
        self.is_locked = False
        self.approved_at = None
        self.approved_by = None
        self.save(update_fields=["is_locked", "approved_at", "approved_by", "updated_at"])

    def save(self, *args, **kwargs):
        self.bsa_invoice = self._generate_bsa_invoice()
        self.fueling_charges = self.FIXED_FUELING_CHARGES
        self.bsa_fueling_charges = self.FIXED_FUELING_CHARGES
        self.pso_price = self._calculate_price(self.pso_rate)
        self.bsa_price = self._calculate_price(self.bsa_rate)
        self.pso_gst = self._calculate_gst(self.pso_price)
        self.bsa_gst = self._calculate_gst(self.bsa_price)
        self.pso_total_price = self._calculate_total(
            self.pso_price,
            self.fueling_charges,
            self.pso_gst,
        )
        self.bsa_total_price = self._calculate_total(
            self.bsa_price,
            self.bsa_fueling_charges,
            self.bsa_gst,
        )
        self.profit = self.calculate_profit()
        super().save(*args, **kwargs)
