from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db.models import DecimalField, Sum, Value
from django.db.models.functions import Coalesce
from django.db import models
from django.utils import timezone


class BalanceSheet(models.Model):
    date = models.DateField(default=timezone.localdate)
    order = models.OneToOneField(
        "orders.Order",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="balance_sheet",
    )
    aviation_dr_no = models.CharField(max_length=100, blank=True)
    aviation_total_due = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    aviation_paid = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    aviation_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    payment_method = models.CharField(max_length=30, blank=True)
    payment_reference = models.CharField(max_length=100, blank=True)
    payment_notes = models.TextField(blank=True)
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
    client_payment = models.OneToOneField(
        "clients.ClientPayment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="balance_sheet_record",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-date", "-updated_at")
        constraints = [
            models.UniqueConstraint(
                fields=("date",),
                condition=models.Q(order__isnull=True),
                name="unique_daily_balance_sheet_date",
            )
        ]

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

    @classmethod
    def calculate_pso_deposited_total(cls, as_of_date) -> Decimal:
        total = (
            PsoDeposit.objects.filter(date__lte=as_of_date).aggregate(
                total=Coalesce(
                    Sum("amount"),
                    Value(Decimal("0.00"), output_field=DecimalField(max_digits=14, decimal_places=2)),
                )
            )["total"]
            or Decimal("0.00")
        )
        return total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @classmethod
    def calculate_pso_consumed_total(cls, as_of_date) -> Decimal:
        from orders.models import Order, OrderStatus

        completed_orders = Order.objects.filter(
            status=OrderStatus.COMPLETED,
            financial__isnull=False,
            date__lte=as_of_date,
        )
        total = completed_orders.aggregate(
            total=Coalesce(
                Sum("financial__pso_total_price"),
                Value(Decimal("0.00"), output_field=DecimalField(max_digits=14, decimal_places=2)),
            )
        )["total"] or Decimal("0.00")
        return total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @classmethod
    def get_pso_summary(cls, as_of_date) -> dict[str, Decimal]:
        deposited = cls.calculate_pso_deposited_total(as_of_date)
        consumed = cls.calculate_pso_consumed_total(as_of_date)
        balance = (deposited - consumed).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return {
            "date": as_of_date,
            "deposited": deposited,
            "consumed": consumed,
            "balance": balance,
        }

    def apply_running_balances(self) -> Decimal:
        self.aviation_balance = self.calculate_aviation_balance()
        if self.order_id:
            self.pso_deposited = self._quantize(self.pso_deposited or Decimal("0.00"))
            self.pso_consumed = self._quantize(self.pso_consumed or Decimal("0.00"))
        else:
            summary = self.get_pso_summary(self.date)
            self.pso_deposited = summary["deposited"]
            self.pso_consumed = summary["consumed"]
        self.pso_balance = self.calculate_pso_balance()
        return self.pso_balance

    @classmethod
    def rebuild_chain(cls, start_date=None):
        queryset = cls.objects.filter(order__isnull=True).prefetch_related("pso_deposits").order_by("date", "created_at", "pk")
        if start_date is not None:
            queryset = queryset.filter(date__gte=start_date)

        for record in queryset:
            record.apply_running_balances()
            super(BalanceSheet, record).save(
                update_fields=["aviation_balance", "pso_deposited", "pso_consumed", "pso_balance", "updated_at"]
            )

    def save(self, *args, **kwargs):
        self.aviation_balance = self.calculate_aviation_balance()
        self.pso_balance = self.calculate_pso_balance()
        super().save(*args, **kwargs)


class PsoDeposit(models.Model):
    balance_sheet = models.ForeignKey(BalanceSheet, on_delete=models.CASCADE, related_name="pso_deposits")
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    date = models.DateField(default=timezone.localdate)
    mode = models.CharField(max_length=30, blank=True)
    reference = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("date", "created_at", "pk")

    def __str__(self) -> str:
        return f"PSO deposit {self.amount} on {self.date.isoformat()}"
