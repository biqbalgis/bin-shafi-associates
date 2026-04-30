from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import UserRole


User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "client",
            "client_name",
            "is_active",
        )


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(choices=UserRole.choices, default=UserRole.CUSTOMER)

    class Meta:
        model = User
        fields = (
            "username",
            "email",
            "first_name",
            "last_name",
            "password",
            "password_confirm",
            "role",
            "client",
        )

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        if attrs.get("role") != UserRole.CUSTOMER:
            raise serializers.ValidationError({"role": "Public registration is limited to customer accounts."})
        if not attrs.get("client"):
            raise serializers.ValidationError({"client": "Customer registration requires a client."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class AdminUserManagementSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)
    password = serializers.CharField(write_only=True, min_length=8, required=False)
    password_confirm = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "password",
            "password_confirm",
            "role",
            "client",
            "client_name",
            "is_active",
        )
        read_only_fields = ("id", "client_name")

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        password = attrs.get("password")
        password_confirm = attrs.get("password_confirm")

        if instance is None:
            if not password:
                raise serializers.ValidationError({"password": "Password is required."})
            if password_confirm is None:
                raise serializers.ValidationError({"password_confirm": "Confirm the password."})

        if password is not None or password_confirm is not None:
            if password != password_confirm:
                raise serializers.ValidationError({"password_confirm": "Passwords do not match."})

        role = attrs.get("role", instance.role if instance else UserRole.CUSTOMER)
        client = attrs.get("client", instance.client if instance else None)

        if role == UserRole.CUSTOMER and not client:
            raise serializers.ValidationError({"client": "Customer accounts require a client."})

        if role != UserRole.CUSTOMER and "client" not in attrs:
            attrs["client"] = None
        elif role != UserRole.CUSTOMER and attrs.get("client"):
            attrs["client"] = None

        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm", None)
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        validated_data.pop("password_confirm", None)
        password = validated_data.pop("password", None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save(update_fields=["password"])
        return user


class LoginSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["username"] = user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
