from rest_framework import serializers
from .models import Donation, DistributionAudit, FoodType, DonationStatus, RiskLevel
from .ai_engine import SmartSafetyUrgencyEngine
from users.serializers import UserSerializer

class DistributionAuditSerializer(serializers.ModelSerializer):
    updated_by = UserSerializer(read_only=True)

    class Meta:
        model = DistributionAudit
        fields = ['id', 'timestamp', 'previous_status', 'new_status', 'updated_by', 'notes']

class DonationSerializer(serializers.ModelSerializer):
    donor = UserSerializer(read_only=True)
    claimed_by = UserSerializer(read_only=True)
    audit_logs = DistributionAuditSerializer(many=True, read_only=True)
    ai_insight = serializers.SerializerMethodField()

    class Meta:
        model = Donation
        fields = [
            'id', 'donor', 'food_title', 'food_type', 'quantity_amount', 'quantity_unit',
            'quantity', 'pickup_location', 'latitude', 'longitude', 'expiry_hours',
            'available_until', 'ai_urgency_score', 'ai_risk_level', 'ai_insight',
            'image_verified', 'image_quality_score',
            'status', 'claimed_by', 'audit_logs', 'created_at', 'updated_at'
        ]

    def get_ai_insight(self, obj):
        result = SmartSafetyUrgencyEngine.calculate_urgency_score(
            obj.food_type, obj.expiry_hours, obj.created_at
        )
        return result['insight']

class DonationCreateSerializer(serializers.ModelSerializer):
    food_type = serializers.ChoiceField(choices=FoodType.choices, default=FoodType.COOKED)
    quantity_amount = serializers.IntegerField(min_value=1, default=1)
    quantity_unit = serializers.CharField(max_length=20, default='meals')
    expiry_hours = serializers.IntegerField(min_value=1, default=12)

    class Meta:
        model = Donation
        fields = [
            'food_title', 'food_type', 'quantity_amount', 'quantity_unit',
            'pickup_location', 'latitude', 'longitude', 'expiry_hours', 'available_until',
            'image_verified', 'image_quality_score'
        ]

    def validate_expiry_hours(self, value):
        if value < 1:
            raise serializers.ValidationError("Expiry window must be at least 1 hour from creation.")
        return value

    def create(self, validated_data):
        user = self.context['request'].user
        qty_amount = validated_data.get('quantity_amount', 1)
        qty_unit = validated_data.get('quantity_unit', 'meals')
        quantity_str = f"{qty_amount} {qty_unit}"
        
        food_type = validated_data.get('food_type', FoodType.COOKED)
        expiry_hours = validated_data.get('expiry_hours', 12)

        # Run AI Urgency Score Engine
        ai_res = SmartSafetyUrgencyEngine.calculate_urgency_score(food_type, expiry_hours)

        donation = Donation.objects.create(
            donor=user,
            quantity=quantity_str,
            ai_urgency_score=ai_res['urgency_score'],
            ai_risk_level=ai_res['risk_level'],
            **validated_data
        )
        
        DistributionAudit.objects.create(
            donation=donation,
            previous_status='CREATED',
            new_status=DonationStatus.AVAILABLE,
            updated_by=user,
            notes=f'Initial surplus post created. AI Urgency Score: {ai_res["urgency_score"]}% ({ai_res["risk_level"]})'
        )
        return donation
