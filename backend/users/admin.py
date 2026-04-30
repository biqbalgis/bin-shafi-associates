from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("Business Context", {"fields": ("role", "client")}),
    )
    list_display = ("username", "email", "role", "client", "is_staff", "is_active")
    list_filter = ("role", "is_staff", "is_active")
