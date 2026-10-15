import re
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import UserProfile, UserRole

User = get_user_model()

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = [
            'role', 'phone_number', 'address', 'latitude', 'longitude',
            'organization_name', 'registration_number', 'operating_area',
            'is_approved', 'created_at', 'updated_at'
        ]

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'is_active', 'profile']

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    role = serializers.ChoiceField(choices=UserRole.choices, default=UserRole.DONOR)
    phone_number = serializers.CharField(required=True)
    address = serializers.CharField(required=False, allow_blank=True)
    latitude = serializers.FloatField(required=False, allow_null=True)
    longitude = serializers.FloatField(required=False, allow_null=True)
    organization_name = serializers.CharField(required=True)
    registration_number = serializers.CharField(required=False, allow_blank=True)
    operating_area = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'first_name', 'last_name',
            'role', 'phone_number', 'address', 'latitude', 'longitude',
            'organization_name', 'registration_number', 'operating_area'
        ]

    def validate_phone_number(self, value):
        cleaned = re.sub(r'[\s\-\+\(\)]', '', value)
        if not re.match(r'^[6-9]\d{9}$', cleaned) and not re.match(r'^\d{10}$', cleaned):
            raise serializers.ValidationError("Enter a valid 10-digit Indian mobile number (e.g., 9876543210).")
        return value

    def create(self, validated_data):
        role = validated_data.get('role', UserRole.DONOR)
        
        # Donors & Admins auto-approved; NGOs require Admin approval
        is_approved = (role != UserRole.NGO)

        profile_data = {
            'role': role,
            'phone_number': validated_data.pop('phone_number', ''),
            'address': validated_data.pop('address', ''),
            'latitude': validated_data.pop('latitude', None),
            'longitude': validated_data.pop('longitude', None),
            'organization_name': validated_data.pop('organization_name', ''),
            'registration_number': validated_data.pop('registration_number', ''),
            'operating_area': validated_data.pop('operating_area', ''),
            'is_approved': is_approved
        }

        password = validated_data.pop('password')
        user = User(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            role=role,
            is_staff=(role == UserRole.ADMIN),
            is_superuser=(role == UserRole.ADMIN)
        )
        user.set_password(password)
        user.save()

        UserProfile.objects.create(user=user, **profile_data)
        return user
