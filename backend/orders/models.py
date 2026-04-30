from django.db import models, transaction
from django.utils import timezone


class OrderStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    APPROVED = "APPROVED", "Approved"
    CANCELED = "CANCELED", "Canceled"
    COMPLETED = "COMPLETED", "Completed"


class FlightStatus(models.TextChoices):
    DOMESTIC = "DOMESTIC", "Domestic"
    INTERNATIONAL = "INTERNATIONAL", "International"


class Airport(models.Model):
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=255)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ("code",)

    def __str__(self) -> str:
        return f"{self.code} - {self.name}"


class FuelType(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class FuelCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class FlightReference(models.Model):
    code = models.CharField(max_length=30, unique=True)
    description = models.CharField(max_length=255, blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ("code",)

    def __str__(self) -> str:
        return self.code


class RouteReference(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.CharField(max_length=255, blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class SavedEmailContact(models.Model):
    name = models.CharField(max_length=100, blank=True)
    email = models.EmailField(unique=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("email",)

    def __str__(self) -> str:
        return self.name or self.email


class Order(models.Model):
    ser_no = models.CharField(max_length=30, unique=True, editable=False)
    date = models.DateField()
    flight = models.CharField(max_length=100)
    flight_status = models.CharField(
        max_length=20,
        choices=FlightStatus.choices,
        default=FlightStatus.DOMESTIC,
    )
    client = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="orders")
    aircraft = models.ForeignKey("aircrafts.Aircraft", on_delete=models.PROTECT, related_name="orders")
    airport = models.ForeignKey(Airport, on_delete=models.PROTECT, related_name="orders")
    route = models.CharField(max_length=255)
    dr_no = models.CharField(max_length=100, blank=True)
    approval_email_to = models.EmailField(blank=True)
    approval_email_cc = models.EmailField(blank=True)
    status = models.CharField(max_length=20, choices=OrderStatus.choices, default=OrderStatus.PENDING)
    fuel_type = models.ForeignKey(FuelType, on_delete=models.PROTECT, related_name="orders")
    quantity_ltrs = models.DecimalField(max_digits=12, decimal_places=2)
    created_by = models.ForeignKey("users.User", on_delete=models.PROTECT, related_name="created_orders")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-date", "-created_at")

    def __str__(self) -> str:
        return self.ser_no

    def _generate_serial_number(self) -> str:
        order_date = self.date or timezone.now().date()
        prefix = f"ORD-{order_date:%Y%m%d}"
        with transaction.atomic():
            count = Order.objects.select_for_update().filter(ser_no__startswith=prefix).count() + 1
            serial = f"{prefix}-{count:04d}"
            while Order.objects.filter(ser_no=serial).exists():
                count += 1
                serial = f"{prefix}-{count:04d}"
        return serial

    def save(self, *args, **kwargs):
        if not self.ser_no:
            self.ser_no = self._generate_serial_number()
        super().save(*args, **kwargs)


class OrderStatusAuditLog(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="audit_logs")
    old_status = models.CharField(max_length=20, choices=OrderStatus.choices, blank=True)
    new_status = models.CharField(max_length=20, choices=OrderStatus.choices)
    changed_by = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-changed_at",)

    def __str__(self) -> str:
        return f"{self.order.ser_no}: {self.old_status} -> {self.new_status}"
