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

    def test_route_optimization(self):
        pickups = [
            {"id": "p1", "title": "Bakery Surplus", "latitude": 40.7128, "longitude": -74.0060, "weightKg": 10},
            {"id": "p2", "title": "Hotel Meals", "latitude": 40.7200, "longitude": -73.9950, "weightKg": 15}
        ]
        ngo = {"id": "ngo1", "name": "City Shelter", "latitude": 40.7300, "longitude": -73.9900}
        res = self.optimizer.optimize_volunteer_batch(40.7100, -74.0100, pickups, ngo)
        self.assertIn("optimizedRoute", res)
        self.assertEqual(len(res["optimizedRoute"]), 3) # 2 pickups + 1 drop

if __name__ == "__main__":
    unittest.main()
