import unittest
from datetime import datetime, timedelta, timezone
from matching_engine import AIMatchingEngine
from vision_inspector import FoodVisionInspector
from forecasting_engine import DistrictSurplusForecaster
from route_optimizer import MultiStopRouteOptimizer

class TestAIEngine(unittest.TestCase):
    def setUp(self):
        self.matcher = AIMatchingEngine()
        self.inspector = FoodVisionInspector()
        self.forecaster = DistrictSurplusForecaster()
        self.optimizer = MultiStopRouteOptimizer()

    def test_matching_urgency_decay(self):
        # Expiry in 1 hour -> should have high urgency score
        now = datetime.now(timezone.utc)
        exp_1h = now + timedelta(hours=1)
        score_1h, rem_1h = self.matcher.calculate_urgency_score(exp_1h, now)
        self.assertGreater(score_1h, 70.0)

        # Expiry in 10 hours -> lower urgency
        exp_10h = now + timedelta(hours=10)
        score_10h, rem_10h = self.matcher.calculate_urgency_score(exp_10h, now)
        self.assertLess(score_10h, score_1h)

    def test_vision_inspector(self):
        res = self.inspector.analyze_image(None, "COOKED_MEALS")
        self.assertIn("qualityIndex", res)
        self.assertGreaterEqual(res["qualityIndex"], 50.0)

    def test_forecasting(self):
        forecast = self.forecaster.predict_surplus_hotspots(3)
        self.assertEqual(len(forecast["dailyForecasts"]), 3)
        self.assertIn("logisticsBottleneckSummary", forecast)
        self.assertIn("modelPerformanceMetrics", forecast)

    def test_forecasting_donor_frequency_and_categories(self):
        forecast = self.forecaster.predict_surplus_hotspots(2)
        day1 = forecast["dailyForecasts"][0]
        self.assertIn("districtForecasts", day1)
        bkc = next(d for d in day1["districtForecasts"] if d["districtId"] == "BKC_COMMERCIAL")

        # Category distribution checks
        self.assertIn("categoryBreakdown", bkc)
        cats = bkc["categoryBreakdown"]
        self.assertIn("COOKED", cats)
        self.assertIn("PERISHABLE", cats)
        total_cats = sum(cats.values())
        self.assertAlmostEqual(total_cats, bkc["predictedSurplusKg"], delta=0.5)

        # Statistical analysis checks
        self.assertIn("zScore", bkc)
        self.assertIn("confidenceInterval95", bkc)
        self.assertEqual(len(bkc["confidenceInterval95"]), 2)
        self.assertLessEqual(bkc["confidenceInterval95"][0], bkc["predictedSurplusKg"])
        self.assertGreaterEqual(bkc["confidenceInterval95"][1], bkc["predictedSurplusKg"])

    def test_forecasting_logistics_bottlenecks(self):
        forecast = self.forecaster.predict_surplus_hotspots(2)
        summary = forecast["logisticsBottleneckSummary"]
        self.assertIn("totalForecastSurplusKg", summary)
        self.assertIn("totalStandbyRidersRecommended", summary)
        self.assertIn("fleetBottleneckRisk", summary)

        # Verify district logistics recommendations
        for d in forecast["dailyForecasts"][0]["districtForecasts"]:
            rec = d["logisticsRecommendation"]
            self.assertIn("volunteerRidersNeeded", rec)
            self.assertIn("coldChainRequired", rec)
            self.assertIn("actionRequired", rec)
            self.assertIn(d["bottleneckRisk"], ["CRITICAL", "HIGH", "MODERATE", "STABLE"])

    def test_forecasting_custom_historical_donations(self):
        custom_donations = [
            {
                "donor_id": "custom_hotel_1",
                "donorName": "Grand Hyatt Banquets",
                "districtId": "BKC_COMMERCIAL",
                "food_type": "COOKED",
                "quantity_amount": 280.0,
                "created_at": "2026-10-01T18:00:00Z"
            },
            {
                "donor_id": "custom_hotel_1",
                "donorName": "Grand Hyatt Banquets",
                "districtId": "BKC_COMMERCIAL",
                "food_type": "COOKED",
                "quantity_amount": 320.0,
                "created_at": "2026-10-08T19:00:00Z"
            }
        ]
        forecast = self.forecaster.predict_surplus_hotspots(3, historical_donations=custom_donations)
        self.assertEqual(len(forecast["dailyForecasts"]), 3)
        self.assertGreater(forecast["modelPerformanceMetrics"]["donorCohortSize"], 6)

    def test_route_optimization(self):
        pickups = [
            {"id": "p1", "title": "Bakery Surplus", "latitude": 40.7128, "longitude": -74.0060, "weightKg": 10},
            {"id": "p2", "title": "Hotel Meals", "latitude": 40.7200, "longitude": -73.9950, "weightKg": 15}
        ]
        ngo = {"id": "ngo1", "name": "City Shelter", "latitude": 40.7300, "longitude": -73.9900}
        res = self.optimizer.optimize_volunteer_batch(40.7100, -74.0100, pickups, ngo)
        self.assertIn("optimizedRoute", res)
        self.assertEqual(len(res["optimizedRoute"]), 3) # 2 pickups + 1 drop

    def test_route_optimization_perishability_priority(self):
        # Stop 1 is very close to volunteer (0.15 km) but non-perishable with 48h shelf life
        # Stop 2 is further away (1.8 km) but CRITICAL cooked meals expiring in 1 hour
        pickups = [
            {
                "id": "p_canned",
                "title": "Canned Beans & Pasta",
                "latitude": 40.7110,
                "longitude": -74.0090,
                "foodType": "NON_PERISHABLE",
                "expiryHours": 48.0,
                "aiUrgencyScore": 15.0,
                "aiRiskLevel": "NORMAL",
                "weightKg": 10
            },
            {
                "id": "p_hot_meals",
                "title": "Hot Banquet Catering",
                "latitude": 40.7240,
                "longitude": -73.9980,
                "foodType": "COOKED",
                "expiryHours": 1.0,
                "aiUrgencyScore": 95.0,
                "aiRiskLevel": "CRITICAL",
                "weightKg": 15
            }
        ]
        ngo = {"id": "ngo1", "name": "City Shelter", "latitude": 40.7350, "longitude": -73.9850}
        res = self.optimizer.optimize_volunteer_batch(40.7100, -74.0100, pickups, ngo)
        
        # Verify first stop is the critical expiring food
        first_pickup = res["optimizedRoute"][0]
        self.assertEqual(first_pickup["id"], "p_hot_meals")
        self.assertIn("perishabilityDecayPenalty", first_pickup)
        self.assertGreater(res["carbonSavedTransitKg"], 0.0)

    def test_route_optimization_traffic_weights(self):
        pickups = [
            {"id": "p1", "title": "Bakery", "latitude": 40.7150, "longitude": -74.0050, "weightKg": 5}
        ]
        ngo = {"id": "ngo1", "name": "Shelter", "latitude": 40.7250, "longitude": -73.9950}
        
        # Low traffic (factor 1.0)
        res_light = self.optimizer.optimize_volunteer_batch(40.7100, -74.0100, pickups, ngo, traffic_factor=1.0)
        # Heavy peak traffic (factor 1.8)
        res_heavy = self.optimizer.optimize_volunteer_batch(40.7100, -74.0100, pickups, ngo, traffic_factor=1.8)
        
        self.assertGreater(res_heavy["totalTransitTimeMinutes"], res_light["totalTransitTimeMinutes"])
        self.assertEqual(res_heavy["trafficMultiplier"], 1.8)

    def test_route_optimization_algorithms(self):
        pickups = [
            {"id": "p1", "title": "Bakery", "latitude": 40.7150, "longitude": -74.0050, "weightKg": 5},
            {"id": "p2", "title": "Deli", "latitude": 40.7200, "longitude": -73.9980, "weightKg": 8}
        ]
        ngo = {"id": "ngo1", "name": "Shelter", "latitude": 40.7300, "longitude": -73.9900}

        res_cw = self.optimizer.optimize_volunteer_batch(40.7100, -74.0100, pickups, ngo, algorithm="clarke_wright")
        res_nn = self.optimizer.optimize_volunteer_batch(40.7100, -74.0100, pickups, ngo, algorithm="nearest_neighbor")

        self.assertIn("Clarke-Wright", res_cw["routingAlgorithm"])
        self.assertIn("Nearest-Neighbor", res_nn["routingAlgorithm"])

if __name__ == "__main__":
    unittest.main()
