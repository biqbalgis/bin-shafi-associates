from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import models
from django.utils import timezone


class BalanceSheet(models.Model):
    date = models.DateField(default=timezone.localdate, unique=True)
    aviation_dr_no = models.CharField(max_length=100, blank=True)
    aviation_total_due = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    aviation_paid = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    aviation_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    pso_dr_no = models.CharField(max_length=100, blank=True)
    pso_deposited = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    pso_consumed = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    pso_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    pso_deposited_manual = models.BooleanField(default=True)
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

    def calculate_aviation_balance(self) -> Decimal:
        return self._quantize((self.aviation_total_due or Decimal("0.00")) - (self.aviation_paid or Decimal("0.00")))

    def calculate_pso_balance(self) -> Decimal:
        return self._quantize((self.pso_deposited or Decimal("0.00")) - (self.pso_consumed or Decimal("0.00")))

    def calculate_pso_deposit_total(self) -> Decimal:
        deposits = getattr(self, "_prefetched_objects_cache", {}).get("pso_deposits")
        if deposits is None:
            deposits = self.pso_deposits.all()
        total = sum((deposit.amount or Decimal("0.00") for deposit in deposits), Decimal("0.00"))
        return self._quantize(total)

    def apply_running_balances(self, opening_pso_balance: Decimal) -> Decimal:
        opening_balance = self._quantize(opening_pso_balance or Decimal("0.00"))
        self.aviation_balance = self.calculate_aviation_balance()
        if self.pso_deposited_manual:
            self.pso_deposited = self._quantize(self.pso_deposited or Decimal("0.00"))
        else:
            self.pso_deposited = self._quantize(opening_balance + self.calculate_pso_deposit_total())
        self.pso_balance = self.calculate_pso_balance()
        return self.pso_balance

    @classmethod
    def rebuild_chain(cls, start_date=None):
        queryset = cls.objects.prefetch_related("pso_deposits").order_by("date", "created_at", "pk")
        previous_balance = Decimal("0.00")
        if start_date is not None:
            previous_record = (
                cls.objects.filter(date__lt=start_date)
                .order_by("-date", "-created_at", "-pk")
                .first()
            )
            previous_balance = previous_record.pso_balance if previous_record else Decimal("0.00")
            queryset = queryset.filter(date__gte=start_date)

        for record in queryset:
            record.apply_running_balances(previous_balance)
            super(BalanceSheet, record).save(update_fields=["aviation_balance", "pso_deposited", "pso_balance", "updated_at"])
            previous_balance = record.pso_balance

    def save(self, *args, **kwargs):
        self.aviation_balance = self.calculate_aviation_balance()
        self.pso_balance = self.calculate_pso_balance()
        super().save(*args, **kwargs)


class PsoDeposit(models.Model):
    balance_sheet = models.ForeignKey(BalanceSheet, on_delete=models.CASCADE, related_name="pso_deposits")
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    date = models.DateField(default=timezone.localdate)
    cheque_number = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("date", "created_at", "pk")

    def __str__(self) -> str:
        return f"PSO deposit {self.amount} on {self.date.isoformat()}"
