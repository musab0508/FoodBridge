import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple

class AIMatchingEngine:
    """
    Multi-Factor Dynamic AI Matching & Urgency Engine for FoodBridge.
    Combines PostGIS/Haversine spatial distance, NGO remaining capacity,
    dietary constraint alignment, and exponential time-decay urgency curves.
    """
    def __init__(self, lambda_decay: float = 0.5):
        # Time-decay lambda parameter (controls curve steepness as expiry approaches)
        self.lambda_decay = lambda_decay

    @staticmethod
    def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate great circle distance between two points in kilometers."""
        R = 6371.0 # Earth radius in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    def calculate_urgency_score(self, expiration_eta: datetime, current_time: datetime = None) -> Tuple[float, float]:
        """
        Calculates Urgency Score (0 - 100) using exponential decay curve:
        Urgency = 100 * exp(-lambda * remaining_hours)
        Also returns remaining_hours.
        """
        if current_time is None:
            current_time = datetime.now(timezone.utc)
            
        # Ensure UTC comparison
        if expiration_eta.tzinfo is None:
            expiration_eta = expiration_eta.replace(tzinfo=timezone.utc)
        if current_time.tzinfo is None:
            current_time = current_time.replace(tzinfo=timezone.utc)

        time_to_expiry_seconds = (expiration_eta - current_time).total_seconds()
        remaining_hours = max(0.01, time_to_expiry_seconds / 3600.0)

        # Exponential urgency score calculation
        if remaining_hours <= 0.1:
            urgency = 100.0
        else:
            # Curve spikes sharply as remaining hours drop below 3 hours
            urgency = 100.0 * math.exp(-self.lambda_decay * (remaining_hours - 0.5))
            urgency = max(5.0, min(100.0, urgency))

        return round(urgency, 2), round(remaining_hours, 2)

    def calculate_match_score(
        self,
        donation: Dict[str, Any],
        ngo: Dict[str, Any],
        current_time: datetime = None
    ) -> Dict[str, Any]:
        """
        Calculates multi-factor match score % between a Donation and an NGO.
        """
        # 1. Distance Calculation (Spatial Proximity)
        distance_km = self.haversine_distance(
            donation["latitude"], donation["longitude"],
            ngo["latitude"], ngo["longitude"]
        )
        
        # Max radius cutoff (normal: 10km, urgent <2h expiry: 30km)
        expiration_eta = donation.get("expirationEta")
        if isinstance(expiration_eta, str):
            expiration_eta = datetime.fromisoformat(expiration_eta.replace("Z", "+00:00"))

        urgency_score, remaining_hours = self.calculate_urgency_score(expiration_eta, current_time)
        
        # Dynamic search radius expansion
        search_radius_km = 30.0 if remaining_hours < 2.0 else 15.0
        
        # Proximity score normalized (0-100)
        proximity_score = max(0.0, 100.0 * (1.0 - (distance_km / search_radius_km)))

        # 2. Capacity Score
        servings_needed = donation.get("servingsCount", 10)
        remaining_cap = ngo.get("currentRemaining", 0)
        if remaining_cap >= servings_needed:
            capacity_score = 100.0
        elif remaining_cap > 0:
            capacity_score = (remaining_cap / servings_needed) * 70.0
        else:
            capacity_score = 0.0

        # 3. Dietary Alignment Score
        food_tags = donation.get("dietaryTags", [])
        ngo_constraints = ngo.get("dietaryConstraints", [])
        
        # Check if NGO can accept food storage requirement
        storage_req = donation.get("storageRequirement", "AMBIENT")
        
        dietary_match = True
        if ngo_constraints:
            # If NGO strictly requires Halal or Vegan and donation doesn't match
            for req in ngo_constraints:
                if req in ["HALAL", "VEGETARIAN", "VEGAN", "NUT_FREE"] and req not in food_tags:
                    dietary_match = False
                    break
                    
        dietary_score = 100.0 if dietary_match else 20.0

        # 4. Multi-Factor Weighted Aggregation
        # Weights: Distance (30%), Urgency (35%), Capacity (20%), Dietary (15%)
        final_match_score = (
            (0.30 * proximity_score) +
            (0.35 * urgency_score) +
            (0.20 * capacity_score) +
            (0.15 * dietary_score)
        )

        # Dynamic priority boosting for high urgency listings (< 2 hrs remaining)
        is_urgency_boosted = remaining_hours < 2.0
        if is_urgency_boosted and distance_km <= search_radius_km:
            final_match_score = min(99.9, final_match_score * 1.15)

        return {
            "ngoId": ngo["id"],
            "ngoName": ngo.get("name", "Shelter Partner"),
            "matchScore": round(final_match_score, 1),
            "distanceKm": round(distance_km, 2),
            "urgencyScore": urgency_score,
            "remainingHours": remaining_hours,
            "capacityMatch": capacity_score > 0,
            "dietaryMatch": dietary_match,
            "radiusExpanded": is_urgency_boosted,
            "recommendedPriority": "CRITICAL" if urgency_score > 75 else ("HIGH" if urgency_score > 50 else "NORMAL")
        }

    def rank_ngos_for_donation(
        self,
        donation: Dict[str, Any],
        ngos: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Rank all available NGOs for a given donation in descending match score order."""
        rankings = []
        for ngo in ngos:
            res = self.calculate_match_score(donation, ngo)
            rankings.append(res)
        
        # Sort by match score descending
        rankings.sort(key=lambda x: x["matchScore"], reverse=True)
        return rankings
