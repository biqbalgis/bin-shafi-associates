from django.contrib.auth.models import AbstractUser
from django.db import models


class UserRole(models.TextChoices):
    CUSTOMER = "CUSTOMER", "Customer"
    MANAGER = "MANAGER", "Manager"
    ADMIN = "ADMIN", "Admin"


class User(AbstractUser):
    role = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.CUSTOMER)
    client = models.ForeignKey(
        "clients.Client",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
    )

    def __str__(self) -> str:
        return f"{self.username} ({self.role})"

    def save(self, *args, **kwargs):
        if self.is_superuser:
            self.role = UserRole.ADMIN
            self.is_staff = True
        elif self.role == UserRole.ADMIN:
            self.is_staff = True
        super().save(*args, **kwargs)
