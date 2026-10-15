from django.contrib import admin
from .models import Donation, DistributionAudit

@admin.register(Donation)
class DonationAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'food_title',
        'donor',
        'food_type',
        'quantity',
        'expiry_hours',
        'ai_urgency_score',
        'ai_risk_level',
        'status',
        'claimed_by',
        'created_at'
    )
    list_filter = ('status', 'food_type', 'ai_risk_level')
    search_fields = ('food_title', 'donor__username', 'claimed_by__username', 'pickup_location')

@admin.register(DistributionAudit)
class DistributionAuditAdmin(admin.ModelAdmin):
    list_display = ('id', 'donation', 'previous_status', 'new_status', 'updated_by', 'timestamp')
    list_filter = ('new_status', 'previous_status')
    search_fields = ('donation__food_title', 'updated_by__username', 'notes')
