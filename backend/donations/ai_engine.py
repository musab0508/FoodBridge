import math
from datetime import datetime, timezone

class SmartSafetyUrgencyEngine:
    """
    AI Safety & Urgency Score Engine for FoodBridge.
    Evaluates food type decay weights, remaining shelf-life hours, and ambient degradation factors
    to assign a 0-100% urgency score and risk level (CRITICAL, HIGH, NORMAL).
    """

    FOOD_TYPE_WEIGHTS = {
        'COOKED': 1.6,       # Cooked food deteriorates rapidly (bacterial proliferation zone)
        'PERISHABLE': 1.3,   # Fresh dairy, produce, meats
        'RAW': 1.0,          # Raw unwashed vegetables / ingredients
        'NON_PERISHABLE': 0.4 # Canned goods, dry packaged items
    }

    @classmethod
    def calculate_urgency_score(cls, food_type: str, expiry_hours: float, created_at=None) -> dict:
        weight = cls.FOOD_TYPE_WEIGHTS.get(food_type, 1.0)
        
        # Calculate remaining hours if created_at timestamp is given
        if created_at:
            now = datetime.now(timezone.utc)
            elapsed_hours = (now - created_at).total_seconds() / 3600.0
            remaining_hours = max(0.1, float(expiry_hours) - elapsed_hours)
        else:
            remaining_hours = float(expiry_hours)

        # Non-linear decay curve computation
        base_decay = math.exp(-0.08 * remaining_hours) * 100
        raw_score = (base_decay * 0.6) + ((1.0 / math.sqrt(remaining_hours)) * 25 * weight)
        
        score = min(99.9, max(5.0, round(raw_score, 1)))

        # Assign Dynamic Risk Badges
        if remaining_hours <= 2.0 or score >= 85.0:
            risk_badge = 'CRITICAL'
            insight_text = f"⚡ Critical Urgency: Must be picked up within {round(remaining_hours, 1)} hrs to prevent spoilage."
        elif remaining_hours <= 6.0 or score >= 60.0:
            risk_badge = 'HIGH'
            insight_text = f"⚠️ High Priority: Recommended collection within {round(remaining_hours, 1)} hrs."
        else:
            risk_badge = 'NORMAL'
            insight_text = f"✅ Safe Window: {round(remaining_hours, 1)} hrs remaining for rescue."

        return {
            'urgency_score': score,
            'risk_level': risk_badge,
            'remaining_hours': round(remaining_hours, 1),
            'insight': insight_text
        }
