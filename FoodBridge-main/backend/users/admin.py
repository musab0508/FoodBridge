from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, UserProfile

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'role', 'is_staff', 'is_superuser')
    list_filter = ('role', 'is_staff', 'is_superuser')
    fieldsets = UserAdmin.fieldsets + (
        ('FoodBridge Fields', {'fields': ('role',)}),
    )

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'organization_name', 'phone_number', 'is_approved', 'created_at')
    list_filter = ('role', 'is_approved')
    search_fields = ('user__username', 'organization_name', 'registration_number')
