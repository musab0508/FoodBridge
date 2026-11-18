"""
FoodBridge AI Microservice - Production-Grade Vehicle Routing Problem (VRP) Heuristic.

Solves multi-stop volunteer dispatch combining:
1. High-precision GPS Geodesic & Haversine distance matrices
2. Dynamic urban traffic impedance and peak-hour congestion multipliers
3. Non-linear perishability decay penalty curves prioritizing high-risk expiring food
4. Dual heuristics: Clarke-Wright Savings (CW-TW-P) and Nearest-Neighbor with Time Windows (NN-TW-P)
5. 2-Opt local search refinement evaluating composite perishability and transit cost objectives
"""

import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple, Optional


class MultiStopRouteOptimizer:
    """
    Production-grade Vehicle Routing Problem (VRP) & Perishability Route Optimizer.
    Prioritizes high-risk expiring donations using Clarke-Wright savings or Nearest-Neighbor
    with Time Windows, coupled with 2-Opt local search.
    """

    AVERAGE_URBAN_SPEED_KMH = 30.0     # Baseline city speed in km/h (~0.5 km/min)
    BASE_PICKUP_DWELL_MINS = 5.0       # Loading, verification & inspection dwell
    BASE_DROPOFF_DWELL_MINS = 8.0      # Intake verification & shelter handover dwell
    DEFAULT_TRAFFIC_FACTOR = 1.25      # Standard urban traffic delay coefficient
    DEFAULT_VEHICLE_CAPACITY_KG = 60.0 # Default volunteer vehicle carrying capacity

    # Food vulnerability multipliers
    FOOD_TYPE_WEIGHTS = {
        'COOKED': 1.8,         # Cooked meals, catering, buffet surplus
        'PERISHABLE': 1.4,     # Fresh dairy, raw meats, cut fruits, sandwiches
        'RAW': 1.0,            # Whole raw produce, vegetables
        'NON_PERISHABLE': 0.35 # Canned goods, dry grains, sealed pasta
    }

    # Urgency risk category multipliers
    RISK_LEVEL_WEIGHTS = {
        'CRITICAL': 3.0,       # Shelf life < 2h or urgency >= 85
        'HIGH': 2.0,           # Shelf life 2-6h or urgency >= 60
        'NORMAL': 1.0          # Stable window > 6h
    }

    @staticmethod
    def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculates high-precision great-circle distance between two GPS coordinates using
        WGS-84 mean Earth radius (6371.0088 km). Handles identical points and edge bounds.
        """
        if abs(lat1 - lat2) < 1e-9 and abs(lon1 - lon2) < 1e-9:
            return 0.0

        R = 6371.0088
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
        a = min(1.0, max(0.0, a))
        return R * 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    @classmethod
    def estimate_traffic_multiplier(
        cls,
        departure_time: Optional[datetime] = None,
        custom_traffic_factor: Optional[float] = None
    ) -> float:
        """
        Calculates traffic congestion factor based on time of day or custom weight.
        """
        if custom_traffic_factor is not None and custom_traffic_factor > 0:
            return float(min(3.0, max(1.0, custom_traffic_factor)))

        now = departure_time or datetime.now(timezone.utc)
        hour = now.hour + (now.minute / 60.0)

        if 7.5 <= hour <= 9.5:
            return 1.60  # Morning rush hour
        elif 17.0 <= hour <= 19.5:
            return 1.70  # Evening rush hour
        elif 11.5 <= hour <= 14.0:
            return 1.30  # Lunchtime traffic
        elif 9.5 < hour < 11.5 or 14.0 < hour < 17.0:
            return 1.20  # Normal daytime traffic
        elif 19.5 < hour <= 22.0 or 6.0 <= hour < 7.5:
            return 1.10  # Shoulder hours
        else:
            return 1.00  # Late night / early dawn

    @classmethod
    def calculate_perishability_penalty(
        cls,
        elapsed_mins: float,
        expiry_hours: float,
        urgency_score: float,
        food_type: str = 'COOKED',
        risk_level: str = 'NORMAL'
    ) -> Tuple[float, str]:
        """
        Calculates non-linear perishability decay penalty score.
        Penalizes late arrival heavily as expiry deadline approaches.
        """
        safe_deadline_mins = max(10.0, float(expiry_hours) * 60.0)
        w_food = cls.FOOD_TYPE_WEIGHTS.get(str(food_type).upper(), 1.0)
        w_risk = cls.RISK_LEVEL_WEIGHTS.get(str(risk_level).upper(), 1.0)

        if elapsed_mins <= safe_deadline_mins:
            decay_ratio = elapsed_mins / safe_deadline_mins
            temporal_factor = (decay_ratio ** 2) * 2.0 + (elapsed_mins / 60.0) * 0.5
            if decay_ratio < 0.35:
                status = "OPTIMAL_RESCUE"
            elif decay_ratio < 0.75:
                status = "URGENT_WINDOW"
            else:
                status = "CRITICAL_WINDOW"
        else:
            overdue_hours = (elapsed_mins - safe_deadline_mins) / 60.0
            temporal_factor = 20.0 + 50.0 * (overdue_hours ** 2)
            status = "EXPIRED_RISK"

        penalty = float(urgency_score) * w_food * w_risk * temporal_factor
        return round(penalty, 2), status

    @classmethod
    def evaluate_route_objective(
        cls,
        route: List[Dict[str, Any]],
        start_coords: Tuple[float, float],
        dropoff_coords: Optional[Tuple[float, float]] = None,
        traffic_factor: float = DEFAULT_TRAFFIC_FACTOR,
        dwell_mins: float = BASE_PICKUP_DWELL_MINS
    ) -> Tuple[float, float, float, float, bool]:
        """
        Evaluates composite objective: Distance + Travel Time + Perishability Penalty + Tardiness.
        """
        curr_lat, curr_lng = start_coords
        curr_time = 0.0
        total_dist = 0.0
        total_transit_time = 0.0
        total_decay_pen = 0.0
        tardiness_pen = 0.0
        all_windows_met = True

        for s in route:
            d = cls.haversine(curr_lat, curr_lng, s['latitude'], s['longitude'])
            t_trav = (d / cls.AVERAGE_URBAN_SPEED_KMH * 60.0) * traffic_factor
            t_arr = curr_time + t_trav
            total_dist += d
            total_transit_time += t_trav

            pen, _ = cls.calculate_perishability_penalty(
                t_arr,
                s.get('expiryHours', s.get('expiry_hours', 12.0)),
                s.get('aiUrgencyScore', s.get('ai_urgency_score', 50.0)),
                s.get('foodType', s.get('food_type', 'COOKED')),
                s.get('aiRiskLevel', s.get('ai_risk_level', 'NORMAL'))
            )
            total_decay_pen += pen

            dl = max(10.0, float(s.get('expiryHours', s.get('expiry_hours', 12.0))) * 60.0)
            if t_arr > dl:
                all_windows_met = False
                tardiness_pen += 2500.0 + 60.0 * (t_arr - dl)

            curr_time = t_arr + dwell_mins
            curr_lat, curr_lng = s['latitude'], s['longitude']

        if dropoff_coords:
            d_drop = cls.haversine(curr_lat, curr_lng, dropoff_coords[0], dropoff_coords[1])
            t_drop = (d_drop / cls.AVERAGE_URBAN_SPEED_KMH * 60.0) * traffic_factor
            total_dist += d_drop
            total_transit_time += t_drop

        cost = total_dist * 1.0 + total_transit_time * 0.5 + total_decay_pen * 0.8 + tardiness_pen
        return cost, total_dist, total_transit_time, total_decay_pen, all_windows_met

    @classmethod
    def apply_perishability_2opt(
        cls,
        route: List[Dict[str, Any]],
        start_coords: Tuple[float, float],
        dropoff_coords: Optional[Tuple[float, float]] = None,
        traffic_factor: float = DEFAULT_TRAFFIC_FACTOR,
        dwell_mins: float = BASE_PICKUP_DWELL_MINS,
        max_iterations: int = 50
    ) -> List[Dict[str, Any]]:
        """
        2-Opt local search refinement evaluating swaps using composite perishability objective.
        Untangles GPS crossings while preserving early placement of critical expiring donations.
        """
        if len(route) < 3:
            return list(route)

        best_route = list(route)
        best_cost, _, _, _, _ = cls.evaluate_route_objective(
            best_route, start_coords, dropoff_coords, traffic_factor, dwell_mins
        )

        improved = True
        iteration = 0
        while improved and iteration < max_iterations:
            improved = False
            iteration += 1
            n = len(best_route)

            for i in range(n - 1):
                for j in range(i + 1, n):
                    cand_route = best_route[:i] + best_route[i:j + 1][::-1] + best_route[j + 1:]
                    cand_cost, _, _, _, _ = cls.evaluate_route_objective(
                        cand_route, start_coords, dropoff_coords, traffic_factor, dwell_mins
                    )
                    if cand_cost < best_cost - 1e-4:
                        best_cost = cand_cost
                        best_route = cand_route
                        improved = True
                        break
                if improved:
                    break

        return best_route

    @classmethod
    def solve_vrp_clarke_wright(
        cls,
        start_loc: Tuple[float, float],
        waypoints: List[Dict[str, Any]],
        dropoff_loc: Optional[Tuple[float, float]] = None,
        traffic_factor: float = DEFAULT_TRAFFIC_FACTOR,
        dwell_mins: float = BASE_PICKUP_DWELL_MINS,
        vehicle_capacity_kg: float = DEFAULT_VEHICLE_CAPACITY_KG
    ) -> List[Dict[str, Any]]:
        """
        Clarke-Wright Savings VRP Heuristic adapted for Time Windows & Perishability (CW-TW-P).
        Uses exact objective cost delta Savings(R1, R2) = Cost(R1) + Cost(R2) - Cost(R1 + R2)
        so that merging preserving high-risk food freshness is heavily rewarded.
        """
        n = len(waypoints)
        if n <= 1:
            return list(waypoints)

        routes: List[List[Dict[str, Any]]] = [[s] for s in waypoints]

        def get_route_idx(stop_id: Any) -> Optional[int]:
            for idx, r in enumerate(routes):
                for node in r:
                    if node['id'] == stop_id:
                        return idx
            return None

        # Precompute individual route costs
        individual_costs = {
            s['id']: cls.evaluate_route_objective([s], start_loc, dropoff_loc, traffic_factor, dwell_mins)[0]
            for s in waypoints
        }

        # Calculate generalized savings for all directed pairs (i, j)
        savings = []
        for i in waypoints:
            for j in waypoints:
                if i['id'] == j['id']:
                    continue
                cost_i = individual_costs[i['id']]
                cost_j = individual_costs[j['id']]
                cost_ij, _, _, _, feasible_ij = cls.evaluate_route_objective(
                    [i, j], start_loc, dropoff_loc, traffic_factor, dwell_mins
                )
                sav = (cost_i + cost_j) - cost_ij
                savings.append((sav, i['id'], j['id']))

        savings.sort(key=lambda x: x[0], reverse=True)

        # Merge routes sequentially based on highest savings
        for sav, i_id, j_id in savings:
            idx1 = get_route_idx(i_id)
            idx2 = get_route_idx(j_id)
            if idx1 is None or idx2 is None or idx1 == idx2:
                continue

            r1 = routes[idx1]
            r2 = routes[idx2]

            # Merge condition: i must be the last stop of r1 and j must be the first stop of r2
            if r1[-1]['id'] == i_id and r2[0]['id'] == j_id:
                cand_merged = r1 + r2

                # Capacity check
                total_load = sum(node.get('weightKg', node.get('weight_kg', 5.0)) for node in cand_merged)
                if total_load > vehicle_capacity_kg:
                    continue

                # Time window deadline check
                curr_t = 0.0
                prev_loc = start_loc
                feasible = True
                for node in cand_merged:
                    d = cls.haversine(prev_loc[0], prev_loc[1], node['latitude'], node['longitude'])
                    curr_t += (d / cls.AVERAGE_URBAN_SPEED_KMH * 60.0) * traffic_factor
                    exp_h = float(node.get('expiryHours', node.get('expiry_hours', 12.0)))
                    if curr_t > exp_h * 60.0:
                        feasible = False
                        break
                    curr_t += dwell_mins
                    prev_loc = (node['latitude'], node['longitude'])

                if feasible:
                    r1.extend(r2)
                    routes.pop(idx2)

        # Sort remaining sub-routes so route containing highest urgency item is visited first
        routes.sort(key=lambda r: max(float(n.get('aiUrgencyScore', n.get('ai_urgency_score', 50.0))) for n in r), reverse=True)
        ordered_stops: List[Dict[str, Any]] = []
        for r in routes:
            ordered_stops.extend(r)

        return ordered_stops

    def solve_tsp_nearest_neighbor(
        self,
        start_loc: Tuple[float, float],
        waypoints: List[Dict[str, Any]],
        traffic_factor: float = DEFAULT_TRAFFIC_FACTOR,
        dwell_mins: float = BASE_PICKUP_DWELL_MINS
    ) -> List[Dict[str, Any]]:
        """
        Solves VRP/TSP using Perishability-Aware Nearest-Neighbor with Time Windows (NN-TW-P).
        Prioritizes high-risk expiring food first.
        """
        unvisited = list(waypoints)
        current_lat, current_lng = start_loc
        ordered_route = []
        total_distance = 0.0
        current_time = 0.0

        while unvisited:
            best_candidate = None
            best_score = float('inf')

            for s in unvisited:
                dist = self.haversine(current_lat, current_lng, s["latitude"], s["longitude"])
                transit_time = (dist / self.AVERAGE_URBAN_SPEED_KMH * 60.0) * traffic_factor
                arr_time = current_time + transit_time

                exp_h = float(s.get("expiryHours", s.get("expiry_hours", 12.0)))
                urg = float(s.get("aiUrgencyScore", s.get("ai_urgency_score", 50.0)))
                f_type = str(s.get("foodType", s.get("food_type", "COOKED")))
                r_level = str(s.get("aiRiskLevel", s.get("ai_risk_level", "NORMAL")))

                decay_penalty, _ = self.calculate_perishability_penalty(
                    arr_time, exp_h, urg, f_type, r_level
                )

                safe_deadline = max(10.0, exp_h * 60.0)
                time_margin = safe_deadline - arr_time

                tardiness_cost = 0.0
                if time_margin < 0:
                    tardiness_cost = 2500.0 + abs(time_margin) * 60.0

                margin_hours = max(0.2, time_margin / 60.0)
                priority_bonus = urg * (1.0 + 4.0 / margin_hours)

                composite_cost = (
                    dist * 1.0 +
                    transit_time * 0.5 +
                    decay_penalty * 0.5 +
                    tardiness_cost -
                    priority_bonus * 0.8
                )

                if composite_cost < best_score:
                    best_score = composite_cost
                    best_candidate = (s, dist, transit_time, arr_time)

            if not best_candidate:
                break

            s, dist, transit_time, arr_time = best_candidate
            unvisited.remove(s)
            total_distance += dist
            current_lat = s["latitude"]
            current_lng = s["longitude"]

            decay_penalty, perish_status = self.calculate_perishability_penalty(
                arr_time,
                float(s.get("expiryHours", s.get("expiry_hours", 12.0))),
                float(s.get("aiUrgencyScore", s.get("ai_urgency_score", 50.0))),
                str(s.get("foodType", s.get("food_type", "COOKED"))),
                str(s.get("aiRiskLevel", s.get("ai_risk_level", "NORMAL")))
            )

            dep_time = arr_time + dwell_mins
            current_time = dep_time

            s["cumulativeDistKm"] = round(total_distance, 2)
            s["legDistanceKm"] = round(dist, 2)
            s["estLegTimeMinutes"] = round(transit_time, 1)
            s["estArrivalTimeMinutes"] = round(arr_time, 1)
            s["serviceDwellMinutes"] = round(dwell_mins, 1)
            s["departureTimeMinutes"] = round(dep_time, 1)
            s["perishabilityDecayPenalty"] = round(decay_penalty, 2)
            s["perishabilityStatus"] = perish_status
            s["trafficFactor"] = round(traffic_factor, 2)

            ordered_route.append(s)

        return ordered_route

    def optimize_volunteer_batch(
        self,
        volunteer_lat: float,
        volunteer_lng: float,
        pickups: List[Dict[str, Any]],
        dropoff_ngo: Dict[str, Any],
        traffic_factor: Optional[float] = None,
        algorithm: str = "auto",
        vehicle_capacity_kg: Optional[float] = None,
        service_time_mins: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Optimizes a multi-pickup single-dropoff batch trip for a volunteer rider.
        Factors in GPS coordinates, traffic weights, and perishability decay penalties.
        """
        start_point = (float(volunteer_lat), float(volunteer_lng))
        dwell_mins = float(service_time_mins or self.BASE_PICKUP_DWELL_MINS)
        drop_dwell_mins = float(self.BASE_DROPOFF_DWELL_MINS)
        capacity_kg = float(vehicle_capacity_kg or self.DEFAULT_VEHICLE_CAPACITY_KG)
        effective_traffic = self.estimate_traffic_multiplier(custom_traffic_factor=traffic_factor)

        dropoff_loc = None
        if dropoff_ngo and "latitude" in dropoff_ngo and "longitude" in dropoff_ngo:
            dropoff_loc = (float(dropoff_ngo["latitude"]), float(dropoff_ngo["longitude"]))

        # Prepare and normalize pickup waypoints
        waypoints = []
        risk_counts = {"CRITICAL": 0, "HIGH": 0, "NORMAL": 0}

        for p in pickups:
            p_lat = float(p.get("latitude") or volunteer_lat)
            p_lng = float(p.get("longitude") or volunteer_lng)
            if not (-90.0 <= p_lat <= 90.0 and -180.0 <= p_lng <= 180.0):
                p_lat, p_lng = volunteer_lat, volunteer_lng

            exp_h = float(p.get("expiryHours") or p.get("expiry_hours") or 12.0)
            urg = float(p.get("aiUrgencyScore") or p.get("ai_urgency_score") or p.get("urgencyScore") or 50.0)
            f_type = str(p.get("foodType") or p.get("food_type") or "COOKED").upper()
            r_level = str(p.get("aiRiskLevel") or p.get("ai_risk_level") or p.get("riskLevel") or "NORMAL").upper()

            if r_level in risk_counts:
                risk_counts[r_level] += 1

            servings = int(p.get("servings") or p.get("servingsCount") or 10)
            weight = float(p.get("weightKg") or p.get("weight_kg") or p.get("quantity_amount") or 5.0)

            waypoints.append({
                "id": p["id"],
                "name": p.get("title") or p.get("name") or f"Pickup {p['id']}",
                "address": p.get("address") or p.get("pickup_location") or "Donor Location",
                "latitude": p_lat,
                "longitude": p_lng,
                "type": "PICKUP",
                "servings": servings,
                "weightKg": weight,
                "foodType": f_type,
                "expiryHours": exp_h,
                "aiUrgencyScore": urg,
                "aiRiskLevel": r_level
            })

        if not waypoints:
            # Handle empty batch case
            dropoff_wp = None
            total_dist = 0.0
            total_time = 0.0
            full_route = []

            if dropoff_ngo and dropoff_loc:
                drop_dist = self.haversine(volunteer_lat, volunteer_lng, dropoff_loc[0], dropoff_loc[1])
                drop_time = (drop_dist / self.AVERAGE_URBAN_SPEED_KMH * 60.0) * effective_traffic
                dropoff_wp = {
                    "id": dropoff_ngo.get("id", "ngo-dropoff"),
                    "name": dropoff_ngo.get("name", "NGO Shelter Intake"),
                    "address": dropoff_ngo.get("address", "NGO Address"),
                    "latitude": dropoff_loc[0],
                    "longitude": dropoff_loc[1],
                    "type": "DELIVERY",
                    "servings": 0,
                    "weightKg": 0.0,
                    "legDistanceKm": round(drop_dist, 2),
                    "cumulativeDistKm": round(drop_dist, 2),
                    "estLegTimeMinutes": round(drop_time, 1),
                    "estArrivalTimeMinutes": round(drop_time, 1),
                    "serviceDwellMinutes": round(drop_dwell_mins, 1),
                    "departureTimeMinutes": round(drop_time + drop_dwell_mins, 1),
                    "foodType": "BATCH_COLLECTION",
                    "expiryHours": 0.0,
                    "aiUrgencyScore": 0.0,
                    "aiRiskLevel": "DELIVERED",
                    "perishabilityDecayPenalty": 0.0,
                    "perishabilityStatus": "DELIVERED",
                    "trafficFactor": round(effective_traffic, 2)
                }
                full_route.append(dropoff_wp)
                total_dist = drop_dist
                total_time = drop_time + drop_dwell_mins

            return {
                "volunteerStart": {"latitude": volunteer_lat, "longitude": volunteer_lng},
                "totalStops": len(full_route),
                "optimizedRoute": full_route,
                "totalDistanceKm": round(total_dist, 2),
                "totalEstTimeMinutes": round(total_time, 1),
                "totalTransitTimeMinutes": round(total_dist / self.AVERAGE_URBAN_SPEED_KMH * 60.0 * effective_traffic, 1),
                "totalServiceTimeMinutes": round(drop_dwell_mins if dropoff_wp else 0.0, 1),
                "totalPayloadKg": 0.0,
                "routingAlgorithm": "VRP Empty Batch",
                "carbonSavedTransitKg": 0.0,
                "perishabilityPenaltyScore": 0.0,
                "trafficMultiplier": round(effective_traffic, 2),
                "highRiskPrioritizedCount": 0,
                "timeWindowsRespected": True,
                "riskBreakdown": risk_counts,
                "routePolylinePoints": [
                    [volunteer_lat, volunteer_lng],
                    *([[w["latitude"], w["longitude"]] for w in full_route] if full_route else [])
                ]
            }

        # Solve VRP using requested heuristic
        algo_choice = algorithm.lower().strip()
        candidate_cw: Optional[List[Dict[str, Any]]] = None
        candidate_nn: Optional[List[Dict[str, Any]]] = None

        if algo_choice in ("clarke_wright", "auto"):
            cw_raw = self.solve_vrp_clarke_wright(
                start_point, waypoints, dropoff_loc, effective_traffic, dwell_mins, capacity_kg
            )
            candidate_cw = self.apply_perishability_2opt(
                cw_raw, start_point, dropoff_loc, effective_traffic, dwell_mins
            )

        if algo_choice in ("nearest_neighbor", "auto"):
            nn_raw = self.solve_tsp_nearest_neighbor(
                start_point, waypoints, effective_traffic, dwell_mins
            )
            candidate_nn = self.apply_perishability_2opt(
                nn_raw, start_point, dropoff_loc, effective_traffic, dwell_mins
            )

        # Select winner
        selected_route: List[Dict[str, Any]]
        routing_algo_name: str

        if algo_choice == "clarke_wright" and candidate_cw is not None:
            selected_route = candidate_cw
            routing_algo_name = "Clarke-Wright Savings VRP + Perishability 2-Opt"
        elif algo_choice == "nearest_neighbor" and candidate_nn is not None:
            selected_route = candidate_nn
            routing_algo_name = "Nearest-Neighbor TW-VRP + Perishability 2-Opt"
        else:
            cost_cw = float('inf')
            cost_nn = float('inf')
            if candidate_cw:
                cost_cw, _, _, _, _ = self.evaluate_route_objective(
                    candidate_cw, start_point, dropoff_loc, effective_traffic, dwell_mins
                )
            if candidate_nn:
                cost_nn, _, _, _, _ = self.evaluate_route_objective(
                    candidate_nn, start_point, dropoff_loc, effective_traffic, dwell_mins
                )

            if cost_cw <= cost_nn and candidate_cw:
                selected_route = candidate_cw
                routing_algo_name = "Clarke-Wright Savings VRP + Perishability 2-Opt"
            else:
                selected_route = candidate_nn or waypoints
                routing_algo_name = "Nearest-Neighbor TW-VRP + Perishability 2-Opt"

        # Re-index and format pickup stops along winning sequence
        pickup_order = []
        curr_lat, curr_lng = start_point
        total_trip_dist = 0.0
        total_transit_mins = 0.0
        total_service_mins = 0.0
        curr_time = 0.0
        total_decay_penalty = 0.0
        all_windows_met = True

        for p in selected_route:
            seg_dist = self.haversine(curr_lat, curr_lng, p["latitude"], p["longitude"])
            leg_time = (seg_dist / self.AVERAGE_URBAN_SPEED_KMH * 60.0) * effective_traffic
            arr_time = curr_time + leg_time
            dep_time = arr_time + dwell_mins

            total_trip_dist += seg_dist
            total_transit_mins += leg_time
            total_service_mins += dwell_mins
            curr_time = dep_time

            decay_pen, perish_status = self.calculate_perishability_penalty(
                arr_time,
                p["expiryHours"],
                p["aiUrgencyScore"],
                p["foodType"],
                p["aiRiskLevel"]
            )
            total_decay_penalty += decay_pen

            if arr_time > p["expiryHours"] * 60.0:
                all_windows_met = False

            pickup_order.append({
                "id": p["id"],
                "name": p["name"],
                "address": p["address"],
                "latitude": p["latitude"],
                "longitude": p["longitude"],
                "type": "PICKUP",
                "servings": p["servings"],
                "weightKg": p["weightKg"],
                "legDistanceKm": round(seg_dist, 2),
                "cumulativeDistKm": round(total_trip_dist, 2),
                "estLegTimeMinutes": round(leg_time, 1),
                "estArrivalTimeMinutes": round(arr_time, 1),
                "serviceDwellMinutes": round(dwell_mins, 1),
                "departureTimeMinutes": round(dep_time, 1),
                "foodType": p["foodType"],
                "expiryHours": round(p["expiryHours"], 1),
                "aiUrgencyScore": round(p["aiUrgencyScore"], 1),
                "aiRiskLevel": p["aiRiskLevel"],
                "perishabilityDecayPenalty": round(decay_pen, 2),
                "perishabilityStatus": perish_status,
                "trafficFactor": round(effective_traffic, 2)
            })

            curr_lat, curr_lng = p["latitude"], p["longitude"]

        # Append final dropoff NGO
        full_route = list(pickup_order)
        if dropoff_ngo and dropoff_loc:
            last_lat = curr_lat
            last_lng = curr_lng

            drop_dist = self.haversine(last_lat, last_lng, dropoff_loc[0], dropoff_loc[1])
            drop_leg_time = (drop_dist / self.AVERAGE_URBAN_SPEED_KMH * 60.0) * effective_traffic
            drop_arr_time = curr_time + drop_leg_time
            drop_dep_time = drop_arr_time + drop_dwell_mins

            total_trip_dist += drop_dist
            total_transit_mins += drop_leg_time
            total_service_mins += drop_dwell_mins

            total_servings = sum(w.get("servings", 0) for w in pickup_order)
            total_payload = sum(w.get("weightKg", 0.0) for w in pickup_order)

            dropoff_wp = {
                "id": dropoff_ngo.get("id", "ngo-shelter"),
                "name": dropoff_ngo.get("name", "NGO Shelter Intake"),
                "address": dropoff_ngo.get("address", "NGO Address"),
                "latitude": dropoff_loc[0],
                "longitude": dropoff_loc[1],
                "type": "DELIVERY",
                "servings": total_servings,
                "weightKg": round(total_payload, 1),
                "legDistanceKm": round(drop_dist, 2),
                "cumulativeDistKm": round(total_trip_dist, 2),
                "estLegTimeMinutes": round(drop_leg_time, 1),
                "estArrivalTimeMinutes": round(drop_arr_time, 1),
                "serviceDwellMinutes": round(drop_dwell_mins, 1),
                "departureTimeMinutes": round(drop_dep_time, 1),
                "foodType": "BATCH_COLLECTION",
                "expiryHours": 0.0,
                "aiUrgencyScore": 0.0,
                "aiRiskLevel": "DELIVERED",
                "perishabilityDecayPenalty": 0.0,
                "perishabilityStatus": "DELIVERED",
                "trafficFactor": round(effective_traffic, 2)
            }
            full_route.append(dropoff_wp)

        total_payload_kg = sum(w.get("weightKg", 0.0) for w in pickup_order)
        total_time_mins = total_transit_mins + total_service_mins

        # Baseline comparison: unoptimized individual return trips
        baseline_dist = sum(
            self.haversine(start_point[0], start_point[1], w["latitude"], w["longitude"]) * 2.0
            for w in pickup_order
        )
        if dropoff_loc:
            baseline_dist += self.haversine(start_point[0], start_point[1], dropoff_loc[0], dropoff_loc[1])

        co2_saved_transit_kg = round(max(0.0, baseline_dist - total_trip_dist) * 0.14, 2)

        # Count how many critical/high items were placed in top stops
        high_risk_first_count = sum(
            1 for w in pickup_order[:max(1, len(pickup_order) // 2)]
            if w.get("aiRiskLevel") in ("CRITICAL", "HIGH")
        )

        return {
            "volunteerStart": {"latitude": volunteer_lat, "longitude": volunteer_lng},
            "totalStops": len(full_route),
            "optimizedRoute": full_route,
            "totalDistanceKm": round(total_trip_dist, 2),
            "totalEstTimeMinutes": round(total_time_mins, 1),
            "totalTransitTimeMinutes": round(total_transit_mins, 1),
            "totalServiceTimeMinutes": round(total_service_mins, 1),
            "totalPayloadKg": round(total_payload_kg, 1),
            "routingAlgorithm": routing_algo_name,
            "carbonSavedTransitKg": co2_saved_transit_kg,
            "perishabilityPenaltyScore": round(total_decay_penalty, 2),
            "trafficMultiplier": round(effective_traffic, 2),
            "highRiskPrioritizedCount": high_risk_first_count,
            "timeWindowsRespected": all_windows_met,
            "riskBreakdown": risk_counts,
            "routePolylinePoints": [
                [volunteer_lat, volunteer_lng],
                *[[w["latitude"], w["longitude"]] for w in full_route]
            ]
        }
