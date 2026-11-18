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
    image = serializers.SerializerMethodField()

    class Meta:
        model = Donation
        fields = [
            'id', 'donor', 'food_title', 'food_type', 'quantity_amount', 'quantity_unit',
            'quantity', 'pickup_location', 'latitude', 'longitude', 'expiry_hours',
            'available_until', 'ai_urgency_score', 'ai_risk_level', 'ai_insight',
            'image', 'image_verified', 'image_quality_score',
            'status', 'claimed_by', 'handoff_pin', 'crypto_token', 'audit_logs', 'created_at', 'updated_at'
        ]
        read_only_fields = ['handoff_pin', 'crypto_token', 'image']

    def get_ai_insight(self, obj):
        result = SmartSafetyUrgencyEngine.calculate_urgency_score(
            obj.food_type, obj.expiry_hours, obj.created_at
        )
        return result['insight']

    def get_image(self, obj):
        if obj.image:
            try:
                request = self.context.get('request')
                if request is not None:
                    return request.build_absolute_uri(obj.image.url)
                return f"http://127.0.0.1:8000{obj.image.url}"
            except Exception:
                return str(obj.image)
        return None

class DonationCreateSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)
    food_type = serializers.ChoiceField(choices=FoodType.choices, default=FoodType.COOKED)
    quantity_amount = serializers.IntegerField(min_value=1, default=1)
    quantity_unit = serializers.CharField(max_length=20, default='meals')
    quantity = serializers.CharField(read_only=True)
    expiry_hours = serializers.IntegerField(min_value=1, default=12)
    image = serializers.FileField(required=False, allow_null=True)
    image_verified = serializers.BooleanField(read_only=True)
    image_quality_score = serializers.FloatField(read_only=True)
    ai_urgency_score = serializers.FloatField(read_only=True)
    ai_risk_level = serializers.CharField(read_only=True)
    ai_insight = serializers.SerializerMethodField(read_only=True)
    status = serializers.CharField(read_only=True)
    handoff_pin = serializers.CharField(read_only=True)
    crypto_token = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Donation
        fields = [
            'id', 'food_title', 'food_type', 'quantity_amount', 'quantity_unit', 'quantity',
            'pickup_location', 'latitude', 'longitude', 'expiry_hours', 'available_until',
            'image', 'image_verified', 'image_quality_score',
            'ai_urgency_score', 'ai_risk_level', 'ai_insight', 'status',
            'handoff_pin', 'crypto_token', 'created_at'
        ]
        read_only_fields = [
            'id', 'quantity', 'image_verified', 'image_quality_score',
            'ai_urgency_score', 'ai_risk_level', 'ai_insight',
            'status', 'handoff_pin', 'crypto_token', 'created_at'
        ]

    def get_ai_insight(self, obj):
        res = SmartSafetyUrgencyEngine.calculate_urgency_score(
            obj.food_type, obj.expiry_hours, obj.created_at
        )
        return res['insight']

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

        # Fast local deterministic fallback: if coordinates omitted, use user profile or Mumbai coordinates
        lat = validated_data.get('latitude')
        lng = validated_data.get('longitude')
        if lat is None or lng is None:
            profile = getattr(user, 'profile', None)
            if profile and profile.latitude is not None and profile.longitude is not None:
                validated_data['latitude'] = profile.latitude
                validated_data['longitude'] = profile.longitude
            else:
                # Instant local fallback: Mumbai coordinates [19.0760, 72.8777]
                validated_data['latitude'] = 19.0760
                validated_data['longitude'] = 72.8777

        # Check if an image was provided in validated_data or request.FILES
        request = self.context.get('request')
        image = validated_data.pop('image', None)
        if not image and request and hasattr(request, 'FILES'):
            image = request.FILES.get('image') or request.FILES.get('food_image')

        # Conditional OpenCV inspection: Only run if an image file is actually present
        if image:
            try:
                from .image_inspector import OpenCVImageInspector
                insp = OpenCVImageInspector.inspect_image_bytes(image.read())
                validated_data['image_verified'] = insp.get('verified', False)
                validated_data['image_quality_score'] = insp.get('quality_score', 0.0)
                image.seek(0)
            except Exception:
                validated_data['image_verified'] = False
                validated_data['image_quality_score'] = 0.0
        else:
            validated_data['image_verified'] = False
            validated_data['image_quality_score'] = 0.0

        # Instant in-memory heuristic AI Urgency Score calculation (< 1ms)
        ai_res = SmartSafetyUrgencyEngine.calculate_urgency_score(food_type, expiry_hours)

        donation = Donation.objects.create(
            donor=user,
            quantity=quantity_str,
            ai_urgency_score=ai_res['urgency_score'],
            ai_risk_level=ai_res['risk_level'],
            image=image,
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

    def to_representation(self, instance):
        return DonationSerializer(instance, context=self.context).data
