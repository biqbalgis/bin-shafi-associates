from django.db import models


class Aircraft(models.Model):
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="aircrafts")
    registration_no = models.CharField(max_length=100, unique=True)
    aircraft_model = models.CharField(max_length=100)
    manufacturer = models.CharField(max_length=100, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("registration_no",)

    def __str__(self) -> str:
        return self.registration_no
