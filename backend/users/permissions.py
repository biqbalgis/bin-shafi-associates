from rest_framework.permissions import BasePermission

from .models import UserRole


class IsAdminRole(BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated and request.user.role == UserRole.ADMIN)


class IsManagerOrAdminRole(BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in {UserRole.MANAGER, UserRole.ADMIN}
        )
