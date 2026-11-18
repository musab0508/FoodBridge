from django.db import models
from django.contrib.auth.models import AbstractUser

class UserRole(models.TextChoices):
    DONOR = 'DONOR', 'Donor'
    NGO = 'NGO', 'NGO / Volunteer'
    ADMIN = 'ADMIN', 'Admin'

class User(AbstractUser):
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.DONOR
    )

    def is_donor(self):
        return self.role == UserRole.DONOR

    def is_ngo(self):
        return self.role == UserRole.NGO

    def is_admin_user(self):
        return self.role == UserRole.ADMIN or self.is_superuser

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.DONOR)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)
    organization_name = models.CharField(max_length=255, blank=True, null=True)
    registration_number = models.CharField(max_length=100, blank=True, null=True)
    operating_area = models.CharField(max_length=255, blank=True, null=True)
    is_approved = models.BooleanField(default=False, help_text="Admin approval flag required for NGOs")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} ({self.role}) - Approved: {self.is_approved}"
