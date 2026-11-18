from django.db import models
from django.conf import settings

class FoodType(models.TextChoices):
    PERISHABLE = 'PERISHABLE', 'Perishable'
    NON_PERISHABLE = 'NON_PERISHABLE', 'Non-Perishable'
    COOKED = 'COOKED', 'Cooked Meal'
    RAW = 'RAW', 'Raw Ingredients'

class DonationStatus(models.TextChoices):
    AVAILABLE = 'AVAILABLE', 'Available'
    CLAIMED = 'CLAIMED', 'Claimed'
    IN_TRANSIT = 'IN_TRANSIT', 'In Transit'
    DELIVERED = 'DELIVERED', 'Delivered'
    EXPIRED = 'EXPIRED', 'Expired'

class RiskLevel(models.TextChoices):
    CRITICAL = 'CRITICAL', 'Critical (< 2 hrs)'
    HIGH = 'HIGH', 'High Urgency'
    NORMAL = 'NORMAL', 'Normal'

class Donation(models.Model):
    donor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='donations'
    )
    food_title = models.CharField(max_length=255)
    food_type = models.CharField(
        max_length=50,
        choices=FoodType.choices,
        default=FoodType.COOKED
    )
    quantity_amount = models.IntegerField(default=1, help_text="Numeric quantity count")
    quantity_unit = models.CharField(max_length=20, default="meals", help_text="Unit (kg, meals, packets, liters)")
    quantity = models.CharField(max_length=100, help_text="Formatted string e.g. 10 kg or 50 meals")
    pickup_location = models.TextField()
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)
    expiry_hours = models.IntegerField(default=12, help_text="Hours until food expires (Min: 1)")
    available_until = models.DateTimeField(blank=True, null=True)
    
    # AI Score & Image OpenCV Inspector Fields
    image = models.FileField(upload_to='donations/', blank=True, null=True, help_text="Uploaded food inspection photo")
    ai_urgency_score = models.FloatField(default=50.0, help_text="AI Score 0-100%")
    ai_risk_level = models.CharField(
        max_length=20,
        choices=RiskLevel.choices,
        default=RiskLevel.NORMAL
    )
    image_verified = models.BooleanField(default=False, help_text="OpenCV inspection pass status")
    image_quality_score = models.FloatField(default=0.0, blank=True, null=True, help_text="OpenCV sharpness & brightness score")

    status = models.CharField(
        max_length=20,
        choices=DonationStatus.choices,
        default=DonationStatus.AVAILABLE
    )
    claimed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='claimed_donations'
    )
    handoff_pin = models.CharField(
        max_length=6,
        blank=True,
        null=True,
        help_text="4-digit secure verification PIN for custody transfer"
    )
    crypto_token = models.CharField(
        max_length=128,
        blank=True,
        null=True,
        help_text="Cryptographically signed SHA-256 digital handoff token"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-ai_urgency_score', '-created_at']

    def __str__(self):
        return f"{self.food_title} ({self.quantity}) - {self.get_status_display()} [AI Score: {self.ai_urgency_score}%]"

class DistributionAudit(models.Model):
    donation = models.ForeignKey(
        Donation,
        on_delete=models.CASCADE,
        related_name='audit_logs'
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    previous_status = models.CharField(max_length=50)
    new_status = models.CharField(max_length=50)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_actions'
    )
    notes = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"Audit: {self.donation.food_title} [{self.previous_status} -> {self.new_status}]"


class TelemetryLog(models.Model):
    donation = models.ForeignKey(
        Donation,
        on_delete=models.CASCADE,
        related_name='telemetry_logs',
        null=True,
        blank=True
    )
    volunteer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='telemetry_streams'
    )
    sensor_id = models.CharField(max_length=100)
    temperature_c = models.FloatField(help_text="Temperature in Celsius")
    humidity_pct = models.FloatField(help_text="Relative humidity percentage")
    thermal_breach = models.BooleanField(default=False, help_text="Cold chain violation flag")
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        status_str = "BREACH" if self.thermal_breach else "NORMAL"
        return f"Telemetry [{self.sensor_id}]: {self.temperature_c}°C ({status_str})"


class NotificationLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=50,
        default='SYSTEM',
        help_text="MATCH_BROADCAST, SPOILAGE_ALERT, HANDOFF_CONFIRMATION, TELEMETRY_BREACH, SYSTEM"
    )
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification to {self.user.username}: {self.title} [{self.notification_type}]"

