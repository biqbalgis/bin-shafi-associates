from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, response, status, viewsets
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .permissions import IsAdminRole
from .serializers import AdminUserManagementSerializer, LoginSerializer, RegisterSerializer, UserSerializer


User = get_user_model()


class RegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer


class LoginView(TokenObtainPairView):
    permission_classes = [permissions.AllowAny]
    serializer_class = LoginSerializer


class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return response.Response(serializer.data, status=status.HTTP_200_OK)


class UserManagementViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("client").all().order_by("username")
    serializer_class = AdminUserManagementSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    search_fields = ("username", "email", "first_name", "last_name", "client__name")
    ordering_fields = ("username", "email", "role", "is_active")
