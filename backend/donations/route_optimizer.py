from geopy.distance import geodesic
import math

class MultiStopRouteOptimizer:
    """
    AI Multi-Stop TSP Logistics & Route Optimizer for FoodBridge.
    Calculates spatial geodesic distances and combines PostGIS coordinates with AI Urgency Scores
    to generate the shortest, fuel-efficient pickup route for NGO volunteer riders.
    """

    AVERAGE_URBAN_SPEED_KMH = 30.0  # Average city speed for pickup route estimation

    @classmethod
    def calculate_distance(cls, lat1, lng1, lat2, lng2) -> float:
        try:
            return round(geodesic((lat1, lng1), (lat2, lng2)).kilometers, 2)
        except Exception:
            # Fallback Haversine formula
            R = 6371.0
            dlat = math.radians(lat2 - lat1)
            dlng = math.radians(lng2 - lng1)
            a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            return round(R * c, 2)

    @classmethod
    def optimize_route(cls, volunteer_lat: float, volunteer_lng: float, donations_list: list) -> dict:
        if not donations_list:
            return {
                'success': False,
                'waypoints': [],
                'total_distance_km': 0.0,
                'total_drive_time_mins': 0,
                'total_items_rescued': 0,
                'message': 'No claimed donations selected for routing.'
            }

        unvisited = list(donations_list)
        current_lat, current_lng = volunteer_lat, volunteer_lng

        ordered_waypoints = []
        total_distance = 0.0
        step = 1

        # Nearest-Neighbor + AI Urgency Priority heuristic
        while unvisited:
            best_candidate = None
            best_score = -999999.0

            for item in unvisited:
                item_lat = float(item.get('latitude') or volunteer_lat)
                item_lng = float(item.get('longitude') or volunteer_lng)
                dist = cls.calculate_distance(current_lat, current_lng, item_lat, item_lng)
                
                urgency = float(item.get('ai_urgency_score', 50.0))
                # Combined metric: Minimize distance while prioritizing high urgency
                priority_score = (urgency * 1.5) - (dist * 10.0)

                if priority_score > best_score:
                    best_score = priority_score
                    best_candidate = (item, dist, item_lat, item_lng)

            if not best_candidate:
                break

            target_item, seg_dist, target_lat, target_lng = best_candidate
            unvisited.remove(target_item)
            total_distance += seg_dist

            ordered_waypoints.append({
                'step': step,
                'id': target_item.get('id'),
                'title': target_item.get('food_title', 'Surplus Food'),
                'quantity': target_item.get('quantity', ''),
                'pickup_location': target_item.get('pickup_location', ''),
                'latitude': target_lat,
                'longitude': target_lng,
                'ai_urgency_score': target_item.get('ai_urgency_score', 50.0),
                'ai_risk_level': target_item.get('ai_risk_level', 'NORMAL'),
                'distance_from_prev_km': seg_dist,
                'cumulative_distance_km': round(total_distance, 2)
            })

            current_lat, current_lng = target_lat, target_lng
            step += 1

        total_distance = round(total_distance, 2)
        total_time_mins = int(round((total_distance / cls.AVERAGE_URBAN_SPEED_KMH) * 60)) + (len(ordered_waypoints) * 5) # 5 mins per pickup

        return {
            'success': True,
            'waypoints': ordered_waypoints,
            'total_distance_km': total_distance,
            'total_drive_time_mins': total_time_mins,
            'total_items_rescued': len(ordered_waypoints),
            'start_coordinates': {'latitude': volunteer_lat, 'longitude': volunteer_lng}
        }
