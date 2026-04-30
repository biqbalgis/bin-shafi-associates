from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import models
from django.utils import timezone


class BalanceSheet(models.Model):
    date = models.DateField(default=timezone.localdate, unique=True)
    aviation_total_due = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    aviation_paid = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    aviation_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    pso_deposited = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    pso_consumed = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    pso_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="balance_sheets",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-date", "-updated_at")

    def __str__(self) -> str:
        return f"Balance sheet for {self.date.isoformat()}"

    def _quantize(self, value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def save(self, *args, **kwargs):
        self.aviation_balance = self._quantize((self.aviation_total_due or Decimal("0.00")) - (self.aviation_paid or Decimal("0.00")))
        self.pso_balance = self._quantize((self.pso_deposited or Decimal("0.00")) - (self.pso_consumed or Decimal("0.00")))
        super().save(*args, **kwargs)
