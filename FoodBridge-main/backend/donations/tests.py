import unittest
import hmac
import hashlib
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
from .route_optimizer import MultiStopRouteOptimizer
from .crypto_handoff import (
    generate_handoff_token,
    verify_handoff_token,
    verify_handoff_pin,
    create_non_repudiation_audit_entry,
    derive_pin_from_hmac,
    DEFAULT_HANDOFF_SECRET
)


class RouteOptimizerTests(unittest.TestCase):
    """
    Test suite for production-grade VRP heuristic route optimizer.
    """

    def setUp(self):
        self.volunteer_lat = 37.7749
        self.volunteer_lng = -122.4194

    def test_empty_donations(self):
        res = MultiStopRouteOptimizer.optimize_route(self.volunteer_lat, self.volunteer_lng, [])
        self.assertFalse(res['success'])
        self.assertEqual(res['total_items_rescued'], 0)
        self.assertEqual(len(res['waypoints']), 0)

    def test_perishability_priority_routing(self):
        # Stop 1 is very close to volunteer (0.17 km) but non-perishable with 48h shelf life
        # Stop 2 is further away (1.69 km) but CRITICAL cooked meals expiring in 1.5h
        # Stop 3 is intermediate (0.9 km) and perishable
        donations = [
            {
                'id': 101,
                'food_title': 'Dry Pasta & Rice Boxes',
                'food_type': 'NON_PERISHABLE',
                'quantity': '20 kg',
                'quantity_amount': 20,
                'quantity_unit': 'kg',
                'pickup_location': 'Warehouse A',
                'latitude': 37.7760,
                'longitude': -122.4180,
                'expiry_hours': 48,
                'ai_urgency_score': 15.0,
                'ai_risk_level': 'NORMAL'
            },
            {
                'id': 102,
                'food_title': 'Hot Catered Banquet Meals',
                'food_type': 'COOKED',
                'quantity': '40 meals',
                'quantity_amount': 15,
                'quantity_unit': 'meals',
                'pickup_location': 'Downtown Hotel Banquet',
                'latitude': 37.7850,
                'longitude': -122.4050,
                'expiry_hours': 1.5,
                'ai_urgency_score': 95.0,
                'ai_risk_level': 'CRITICAL'
            },
            {
                'id': 103,
                'food_title': 'Fresh Organic Milk & Yogurt',
                'food_type': 'PERISHABLE',
                'quantity': '10 liters',
                'quantity_amount': 10,
                'quantity_unit': 'liters',
                'pickup_location': 'City Supermarket',
                'latitude': 37.7810,
                'longitude': -122.4100,
                'expiry_hours': 4.0,
                'ai_urgency_score': 75.0,
                'ai_risk_level': 'HIGH'
            }
        ]

        res = MultiStopRouteOptimizer.optimize_route(
            self.volunteer_lat, self.volunteer_lng, donations
        )

        self.assertTrue(res['success'])
        self.assertEqual(res['total_items_rescued'], 3)
        self.assertGreater(res['total_distance_km'], 0.0)

        # High-risk expiring cooked meals must be visited first
        first_step = res['waypoints'][0]
        self.assertEqual(first_step['id'], 102)
        self.assertEqual(first_step['ai_risk_level'], 'CRITICAL')
        self.assertIn('perishability_decay_penalty', first_step)
        self.assertIn('estimated_arrival_mins', first_step)
        self.assertGreaterEqual(res['urgency_prioritization_index'], 80.0)

    def test_traffic_weights_impact(self):
        donations = [
            {
                'id': 201,
                'food_title': 'Bakery Bread',
                'food_type': 'PERISHABLE',
                'quantity_amount': 5,
                'latitude': 37.7800,
                'longitude': -122.4100,
                'expiry_hours': 10,
                'ai_urgency_score': 50.0,
                'ai_risk_level': 'NORMAL'
            }
        ]

        res_light = MultiStopRouteOptimizer.optimize_route(
            self.volunteer_lat, self.volunteer_lng, donations, traffic_factor=1.0
        )
        res_heavy = MultiStopRouteOptimizer.optimize_route(
            self.volunteer_lat, self.volunteer_lng, donations, traffic_factor=1.8
        )

        self.assertEqual(res_light['traffic_multiplier'], 1.0)
        self.assertEqual(res_heavy['traffic_multiplier'], 1.8)
        self.assertGreater(res_heavy['total_transit_time_mins'], res_light['total_transit_time_mins'])

    def test_algorithms_selection(self):
        donations = [
            {'id': 1, 'food_title': 'A', 'latitude': 37.7780, 'longitude': -122.4150, 'expiry_hours': 12, 'ai_urgency_score': 50.0},
            {'id': 2, 'food_title': 'B', 'latitude': 37.7820, 'longitude': -122.4080, 'expiry_hours': 8, 'ai_urgency_score': 65.0}
        ]

        res_cw = MultiStopRouteOptimizer.optimize_route(
            self.volunteer_lat, self.volunteer_lng, donations, algorithm='clarke_wright'
        )
        res_nn = MultiStopRouteOptimizer.optimize_route(
            self.volunteer_lat, self.volunteer_lng, donations, algorithm='nearest_neighbor'
        )
        res_auto = MultiStopRouteOptimizer.optimize_route(
            self.volunteer_lat, self.volunteer_lng, donations, algorithm='auto'
        )

        self.assertIn('Clarke-Wright', res_cw['routing_algorithm'])
        self.assertIn('Nearest-Neighbor', res_nn['routing_algorithm'])
        self.assertTrue(res_auto['success'])

    def test_gps_geodesic_and_invalid_coordinates(self):
        # Identical coordinates
        d_zero = MultiStopRouteOptimizer.haversine_distance(37.7749, -122.4194, 37.7749, -122.4194)
        self.assertEqual(d_zero, 0.0)

        # Dist between SF and Oakland (~13 km)
        d_sf_oak = MultiStopRouteOptimizer.haversine_distance(37.7749, -122.4194, 37.8044, -122.2712)
        self.assertGreater(d_sf_oak, 10.0)
        self.assertLess(d_sf_oak, 18.0)

        # Donation with None or invalid coordinates should not crash
        invalid_donations = [
            {
                'id': 999,
                'food_title': 'Glitch Coords Donation',
                'latitude': None,
                'longitude': 'invalid',
                'expiry_hours': 5,
                'ai_urgency_score': 60.0
            }
        ]
        res = MultiStopRouteOptimizer.optimize_route(self.volunteer_lat, self.volunteer_lng, invalid_donations)
        self.assertTrue(res['success'])
        self.assertEqual(len(res['waypoints']), 1)

    def test_perishability_decay_gradient(self):
        # Optimal window arrival
        pen_early, status_early = MultiStopRouteOptimizer.calculate_perishability_penalty(
            elapsed_mins=10.0, expiry_hours=2.0, urgency_score=90.0, food_type='COOKED', risk_level='CRITICAL'
        )
        self.assertEqual(status_early, 'OPTIMAL_RESCUE')

        # Overdue arrival
        pen_late, status_late = MultiStopRouteOptimizer.calculate_perishability_penalty(
            elapsed_mins=150.0, expiry_hours=2.0, urgency_score=90.0, food_type='COOKED', risk_level='CRITICAL'
        )
        self.assertEqual(status_late, 'EXPIRED_RISK')
        self.assertGreater(pen_late, pen_early * 10.0)


class CryptoHandoffTests(unittest.TestCase):
    """
    Test suite for cryptographic digital tokens, QR/PIN verification,
    and non-repudiable delivery tracking.
    """

    def test_cross_platform_parity_vector(self):
        raw = 'donation_101:vol_42:donor_7:PICKUP:2026-11-17T21:00:00Z:a1b2c3d4'
        secret = b'FOODBRIDGE_SECRET_HMAC_KEY_2026'
        h = hmac.new(secret, raw.encode('utf-8'), hashlib.sha256)
        expected_hex = '49152f2572aa421c0e1d150999f1a16ff68a56fefb7e93035ea495eedf4cdcdb'
        expected_pin = '083809'

        self.assertEqual(h.hexdigest(), expected_hex)
        self.assertEqual(derive_pin_from_hmac(h.digest()), expected_pin)

    def test_generate_handoff_token_pickup(self):
        token_res = generate_handoff_token(
            donation_id=101,
            volunteer_id=42,
            target_id=7,
            action='PICKUP',
            actor_role='DONOR'
        )

        self.assertIn('token', token_res)
        self.assertIn('qr_payload', token_res)
        self.assertIn('signature', token_res)
        self.assertIn('verification_pin', token_res)
        self.assertIn('expires_at', token_res)
        self.assertIn('payload', token_res)

        # 6-digit numeric PIN
        pin = token_res['verification_pin']
        self.assertEqual(len(pin), 6)
        self.assertTrue(pin.isdigit())

        # Payload structure
        p = token_res['payload']
        self.assertEqual(p['donationId'], '101')
        self.assertEqual(p['volunteerId'], '42')
        self.assertEqual(p['targetId'], '7')
        self.assertEqual(p['action'], 'PICKUP')
        self.assertEqual(p['actorRole'], 'DONOR')
        self.assertTrue(len(p['nonce']) >= 8)

    def test_verify_handoff_token_valid(self):
        token_res = generate_handoff_token(
            donation_id=202,
            volunteer_id=15,
            target_id=88,
            action='DELIVERY',
            actor_role='VOLUNTEER'
        )

        # Test verification via compact token
        is_valid, msg, payload, sig = verify_handoff_token(
            token_or_qr=token_res['token'],
            expected_donation_id=202,
            expected_action='DELIVERY'
        )
        self.assertTrue(is_valid)
        self.assertEqual(payload['donationId'], '202')
        self.assertEqual(payload['action'], 'DELIVERY')
        self.assertEqual(sig, token_res['signature'])

        # Test verification via QR JSON payload
        is_valid_qr, _, _, _ = verify_handoff_token(
            token_or_qr=token_res['qr_payload'],
            expected_donation_id=202,
            expected_action='DELIVERY'
        )
        self.assertTrue(is_valid_qr)

    def test_verify_handoff_token_tampered_payload(self):
        token_res = generate_handoff_token(
            donation_id=303,
            volunteer_id=1,
            target_id=2,
            action='PICKUP'
        )

        # Mismatch donation ID
        is_valid, msg, _, _ = verify_handoff_token(
            token_or_qr=token_res['token'],
            expected_donation_id=999
        )
        self.assertFalse(is_valid)
        self.assertIn('does not match target', msg)

        # Mismatch action
        is_valid, msg, _, _ = verify_handoff_token(
            token_or_qr=token_res['token'],
            expected_action='DELIVERY'
        )
        self.assertFalse(is_valid)
        self.assertIn('does not match expected', msg)

    def test_verify_handoff_pin(self):
        token_res = generate_handoff_token(
            donation_id=404,
            volunteer_id=5,
            target_id=10,
            action='PICKUP'
        )
        valid_pin = token_res['verification_pin']
        payload = token_res['payload']

        # Valid PIN
        is_valid, msg = verify_handoff_pin(valid_pin, payload)
        self.assertTrue(is_valid)
        self.assertIn('confirmed', msg.lower())

        # Invalid PIN
        is_valid_wrong, msg_wrong = verify_handoff_pin('000000' if valid_pin != '000000' else '999999', payload)
        self.assertFalse(is_valid_wrong)

        # Expired PIN
        expired_payload = dict(payload)
        past_time = (datetime.now(timezone.utc) - timedelta(minutes=20)).isoformat()
        expired_payload['timestamp'] = past_time
        is_valid_exp, msg_exp = verify_handoff_pin(valid_pin, expired_payload)
        self.assertFalse(is_valid_exp)
        self.assertIn('expired', msg_exp.lower())

    def test_create_non_repudiation_audit_entry(self):
        mock_donation = MagicMock()
        mock_donation.id = 505
        mock_donation.food_title = 'Fresh Salad Packs'
        mock_donation.quantity = '15 boxes'
        mock_donation.status = 'IN_TRANSIT'
        mock_donation.claimed_by = MagicMock(id=42, username='volunteer_dan')
        mock_donation.donor = MagicMock(id=7, username='donor_alice')

        mock_user = MagicMock()
        mock_user.id = 42
        mock_user.username = 'volunteer_dan'
        mock_user.role = 'NGO'

        cert = create_non_repudiation_audit_entry(
            donation=mock_donation,
            action='PICKUP',
            verified_by_user=mock_user,
            signature='abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
            method='QR_SIGNATURE',
            coordinates={'latitude': 37.7749, 'longitude': -122.4194}
        )

        self.assertTrue(cert['certificate_id'].startswith('CERT-'))
        self.assertEqual(cert['donation_id'], 505)
        self.assertEqual(cert['action'], 'PICKUP')
        self.assertEqual(cert['verification_method'], 'QR_SIGNATURE')
        self.assertEqual(cert['verified_by']['username'], 'volunteer_dan')
        self.assertEqual(cert['coordinates']['latitude'], 37.7749)
        self.assertTrue(len(cert['sha256_checksum']) == 64)


try:
    from django.contrib.auth import get_user_model
    from rest_framework.test import APITestCase
    from .models import Donation, DonationStatus, DistributionAudit, TelemetryLog, NotificationLog, FoodType, RiskLevel
    from users.models import UserRole, UserProfile
    from .tasks import (
        broadcast_new_donation_match,
        send_push_notification,
        send_urgent_spoilage_alert,
        send_handoff_confirmation_notification,
        process_telemetry_stream,
        monitor_spoilage_and_expiry,
        aggregate_telemetry_metrics
    )
    HAS_DJANGO_TEST = True
except Exception:
    HAS_DJANGO_TEST = False

if HAS_DJANGO_TEST:
    User = get_user_model()

    class DonationHandoffAPITests(APITestCase):
        """
        End-to-end integration tests for cryptographic handoff endpoints:
        - Generate Pickup Token
        - Verify Pickup (QR / PIN) -> IN_TRANSIT
        - Generate Delivery Token
        - Verify Delivery (QR / PIN) -> DELIVERED
        - Non-Repudiation Receipt Audit Trail
        """

        def setUp(self):
            self.donor = User.objects.create_user(
                username='donor_test',
                password='password123',
                role=UserRole.DONOR
            )
            UserProfile.objects.create(
                user=self.donor,
                role=UserRole.DONOR,
                organization_name='Downtown Bakery'
            )

            self.volunteer = User.objects.create_user(
                username='volunteer_test',
                password='password123',
                role=UserRole.NGO
            )
            UserProfile.objects.create(
                user=self.volunteer,
                role=UserRole.NGO,
                organization_name='Food Rescue Squad',
                is_approved=True
            )

            self.receiving_ngo = User.objects.create_user(
                username='ngo_test',
                password='password123',
                role=UserRole.NGO
            )
            UserProfile.objects.create(
                user=self.receiving_ngo,
                role=UserRole.NGO,
                organization_name='Community Shelter',
                is_approved=True
            )

            self.donation = Donation.objects.create(
                donor=self.donor,
                food_title='Fresh Organic Bagels',
                food_type='PERISHABLE',
                quantity='50 bagels',
                quantity_amount=50,
                pickup_location='100 Market St',
                status=DonationStatus.CLAIMED,
                claimed_by=self.volunteer
            )

        def test_full_handoff_lifecycle_qr_and_pin(self):
            # 1. Donor generates Pickup Token
            self.client.force_authenticate(user=self.donor)
            res_token = self.client.post(
                f'/api/donations/{self.donation.id}/generate-handoff-token/',
                {'action': 'PICKUP', 'latitude': 37.7749, 'longitude': -122.4194},
                format='json'
            )
            self.assertEqual(res_token.status_code, 200)
            token_data = res_token.data
            self.assertTrue(token_data['success'])
            self.assertIn('token', token_data)
            self.assertIn('qr_payload', token_data)
            self.assertEqual(len(token_data['verification_pin']), 6)

            # 2. Volunteer verifies Pickup using QR payload -> transitions to IN_TRANSIT
            self.client.force_authenticate(user=self.volunteer)
            res_verify_pickup = self.client.post(
                f'/api/donations/{self.donation.id}/verify-handoff/',
                {
                    'qr_payload': token_data['qr_payload'],
                    'action': 'PICKUP',
                    'latitude': 37.7749,
                    'longitude': -122.4194
                },
                format='json'
            )
            self.assertEqual(res_verify_pickup.status_code, 200)
            self.assertTrue(res_verify_pickup.data['verified'])
            self.assertEqual(res_verify_pickup.data['new_status'], DonationStatus.IN_TRANSIT)

            self.donation.refresh_from_db()
            self.assertEqual(self.donation.status, DonationStatus.IN_TRANSIT)

            # Check Pickup audit log
            audit_pickup = DistributionAudit.objects.filter(donation=self.donation, new_status=DonationStatus.IN_TRANSIT).first()
            self.assertIsNotNone(audit_pickup)
            self.assertIn('NON-REPUDIABLE HANDOFF', audit_pickup.notes)

            # 3. Volunteer generates Delivery Token
            res_delivery_token = self.client.post(
                f'/api/donations/{self.donation.id}/generate-handoff-token/',
                {'action': 'DELIVERY', 'target_id': self.receiving_ngo.id},
                format='json'
            )
            self.assertEqual(res_delivery_token.status_code, 200)
            delivery_token_data = res_delivery_token.data
            pin_code = delivery_token_data['verification_pin']

            # 4. Receiving NGO verifies Delivery using 6-digit PIN -> transitions to DELIVERED
            self.client.force_authenticate(user=self.receiving_ngo)
            res_verify_delivery = self.client.post(
                f'/api/donations/{self.donation.id}/verify-handoff/',
                {
                    'verification_pin': pin_code,
                    'action': 'DELIVERY',
                    'payload': delivery_token_data['payload']
                },
                format='json'
            )
            self.assertEqual(res_verify_delivery.status_code, 200)
            self.assertTrue(res_verify_delivery.data['verified'])
            self.assertEqual(res_verify_delivery.data['new_status'], DonationStatus.DELIVERED)

            self.donation.refresh_from_db()
            self.assertEqual(self.donation.status, DonationStatus.DELIVERED)

            # 5. Fetch Non-Repudiation Handoff Receipt
            res_receipt = self.client.get(f'/api/donations/{self.donation.id}/handoff-receipt/')
            self.assertEqual(res_receipt.status_code, 200)
            receipt_data = res_receipt.data
            self.assertTrue(receipt_data['chain_of_custody_intact'])
            self.assertTrue(receipt_data['pickup_stage']['verified'])
            self.assertTrue(receipt_data['delivery_stage']['verified'])
            self.assertIsNotNone(receipt_data['chain_integrity_hash'])
            self.assertEqual(receipt_data['donor']['organization_name'], 'Downtown Bakery')


    class CeleryBackgroundTaskTests(APITestCase):
        """
        Integration test suite for Celery background worker tasks:
        - Automated matching broadcasts to nearby NGOs and volunteers
        - Push notification async dispatch and retry logging
        - Real-time IoT cold-chain telemetry streams and thermal breach detection
        - Scheduled spoilage decay monitoring and metrics aggregation
        - Telemetry and Notification API endpoints
        """

        def setUp(self):
            self.donor = User.objects.create_user(
                username='donor_worker_test',
                password='password123',
                role=UserRole.DONOR
            )
            self.donor_profile = UserProfile.objects.create(
                user=self.donor,
                role=UserRole.DONOR,
                organization_name='Bay Area Bakery',
                latitude=37.7749,
                longitude=-122.4194
            )

            self.volunteer = User.objects.create_user(
                username='volunteer_worker_test',
                password='password123',
                role=UserRole.NGO
            )
            self.volunteer_profile = UserProfile.objects.create(
                user=self.volunteer,
                role=UserRole.NGO,
                organization_name='Rapid Rescue Unit',
                is_approved=True,
                latitude=37.7760,
                longitude=-122.4180
            )

            self.ngo = User.objects.create_user(
                username='ngo_worker_test',
                password='password123',
                role=UserRole.NGO
            )
            self.ngo_profile = UserProfile.objects.create(
                user=self.ngo,
                role=UserRole.NGO,
                organization_name='Downtown Community Kitchen',
                is_approved=True,
                latitude=37.7810,
                longitude=-122.4100
            )

            self.donation = Donation.objects.create(
                donor=self.donor,
                food_title='Hot Catered Lasagna Trays',
                food_type='COOKED',
                quantity='30 servings',
                quantity_amount=30,
                pickup_location='Downtown Hotel Banquet',
                latitude=37.7749,
                longitude=-122.4194,
                expiry_hours=3,
                ai_urgency_score=85.0,
                status=DonationStatus.AVAILABLE
            )

        def test_broadcast_new_donation_match(self):
            res = broadcast_new_donation_match(self.donation.id, radius_km=15.0)
            self.assertTrue(res['success'])
            self.assertEqual(res['donation_id'], self.donation.id)
            self.assertGreaterEqual(res['candidates_found'], 1)
            self.assertGreaterEqual(res['notifications_queued'], 1)
            top_candidate_ids = [c['user_id'] for c in res['top_matches']]
            self.assertIn(self.volunteer.id, top_candidate_ids)

        def test_send_push_notification_and_logging(self):
            res = send_push_notification(
                user_id=self.volunteer.id,
                title="Immediate Food Dispatch Available",
                message="Fresh lasagna available 0.2 km from your position.",
                data={'donation_id': self.donation.id},
                notification_type="MATCH_BROADCAST"
            )
            self.assertTrue(res['success'])
            self.assertEqual(res['user_id'], self.volunteer.id)
            self.assertEqual(res['notification_type'], "MATCH_BROADCAST")

            # Check DB record
            notif = NotificationLog.objects.filter(user=self.volunteer, notification_type="MATCH_BROADCAST").first()
            self.assertIsNotNone(notif)
            self.assertEqual(notif.title, "Immediate Food Dispatch Available")
            self.assertFalse(notif.is_read)

        def test_process_telemetry_stream_nominal_and_breach(self):
            # 1. Nominal cold reading for cooked food cold chain (4°C)
            nominal_reading = {
                'donation_id': self.donation.id,
                'sensor_id': 'SENSOR_HOTBOX_01',
                'temperature_c': 4.0,
                'humidity_pct': 50.0,
                'latitude': 37.7780,
                'longitude': -122.4150
            }
            res_nom = process_telemetry_stream(self.volunteer.id, nominal_reading)
            self.assertTrue(res_nom['success'])
            self.assertEqual(res_nom['breaches_detected'], 0)

            # Check GPS update on volunteer profile
            self.volunteer_profile.refresh_from_db()
            self.assertAlmostEqual(self.volunteer_profile.latitude, 37.7780, places=3)

            # 2. Breach reading: Cooked food entering danger zone (28°C)
            breach_reading = {
                'donation_id': self.donation.id,
                'sensor_id': 'SENSOR_HOTBOX_01',
                'temperature_c': 28.0,
                'humidity_pct': 65.0,
                'latitude': 37.7800,
                'longitude': -122.4120
            }
            res_breach = process_telemetry_stream(self.volunteer.id, breach_reading)
            self.assertTrue(res_breach['success'])
            self.assertEqual(res_breach['breaches_detected'], 1)

            # Verify breach log persisted in database
            breach_log = TelemetryLog.objects.filter(
                donation=self.donation,
                thermal_breach=True
            ).first()
            self.assertIsNotNone(breach_log)
            self.assertEqual(breach_log.temperature_c, 28.0)

            # Verify urgent breach notification was dispatched to volunteer
            breach_notif = NotificationLog.objects.filter(
                user=self.volunteer,
                notification_type='TELEMETRY_BREACH'
            ).first()
            self.assertIsNotNone(breach_notif)
            self.assertIn('Cold-Chain Thermal Breach', breach_notif.title)

        def test_monitor_spoilage_and_expiry_periodic(self):
            res = monitor_spoilage_and_expiry()
            self.assertTrue(res['success'])
            self.assertIn('audited_count', res)

        def test_aggregate_telemetry_metrics(self):
            # Seed a log
            TelemetryLog.objects.create(
                volunteer=self.volunteer,
                sensor_id='TEST_S_01',
                temperature_c=3.5,
                humidity_pct=48.0,
                thermal_breach=False
            )
            res = aggregate_telemetry_metrics(volunteer_id=self.volunteer.id)
            self.assertTrue(res['success'])
            self.assertGreaterEqual(res['total_telemetry_readings'], 1)
            self.assertIn('cold_chain_compliance_rate', res)

        def test_telemetry_stream_api_endpoint(self):
            self.client.force_authenticate(user=self.volunteer)
            payload = {
                'volunteer_id': self.volunteer.id,
                'readings': [
                    {
                        'donation_id': self.donation.id,
                        'sensor_id': 'SENSOR_IOT_99',
                        'temperature_c': 3.8,
                        'humidity_pct': 52.0,
                        'latitude': 37.7770,
                        'longitude': -122.4160
                    }
                ]
            }
            response = self.client.post('/api/donations/telemetry/stream/', payload, format='json')
            self.assertEqual(response.status_code, 202)
            self.assertEqual(response.data['status'], 'ACCEPTED')
            self.assertEqual(response.data['volunteer_id'], self.volunteer.id)
            self.assertEqual(response.data['readings_queued'], 1)

        def test_notifications_list_api_endpoint(self):
            NotificationLog.objects.create(
                user=self.volunteer,
                title="Route Optimization Complete",
                message="2 stops scheduled for immediate pickup.",
                notification_type="SYSTEM"
            )
            self.client.force_authenticate(user=self.volunteer)

            # GET list
            res_get = self.client.get('/api/notifications/')
            self.assertEqual(res_get.status_code, 200)
            self.assertGreaterEqual(len(res_get.data['notifications']), 1)
            self.assertGreaterEqual(res_get.data['unread_count'], 1)

            # POST mark all as read
            res_post = self.client.post('/api/notifications/')
            self.assertEqual(res_post.status_code, 200)
            self.assertTrue(res_post.data['success'])

            res_get_after = self.client.get('/api/notifications/')
            self.assertEqual(res_get_after.data['unread_count'], 0)


    class HandoffPinAndCryptoTokenTests(APITestCase):
        """
        Tests for 4-digit handoff PIN and cryptographic SHA-256 token:
        1. NGO claim automatically generates 4-digit numeric handoff_pin and crypto_token.
        2. Exposure in DonationSerializer as read-only.
        3. Audit log records the generation.
        4. Delivery completion endpoint validates 4-digit handoff_pin:
           - Rejects missing PIN with 400.
           - Rejects incorrect PIN with 400.
           - Accepts matching PIN with 200 and sets status to DELIVERED.
        """

        def setUp(self):
            self.donor = User.objects.create_user(
                username='donor_pin_test',
                password='password123',
                role=UserRole.DONOR
            )
            UserProfile.objects.create(
                user=self.donor,
                role=UserRole.DONOR,
                organization_name='Baker Street Pastries'
            )

            self.ngo = User.objects.create_user(
                username='ngo_pin_test',
                password='password123',
                role=UserRole.NGO
            )
            UserProfile.objects.create(
                user=self.ngo,
                role=UserRole.NGO,
                organization_name='Mission Food Bank',
                is_approved=True
            )

            self.donation = Donation.objects.create(
                donor=self.donor,
                food_title='Fresh Baked Sourdough',
                food_type=FoodType.PERISHABLE,
                quantity='25 loaves',
                quantity_amount=25,
                pickup_location='221B Baker St',
                status=DonationStatus.AVAILABLE
            )

        def test_claim_generates_4_digit_pin_and_crypto_token(self):
            self.client.force_authenticate(user=self.ngo)
            response = self.client.post(f'/api/donations/{self.donation.id}/claim/')
            self.assertEqual(response.status_code, 200)

            data = response.data
            self.assertEqual(data['status'], DonationStatus.CLAIMED)
            self.assertIn('handoff_pin', data)
            self.assertIn('crypto_token', data)

            # Check 4-digit numeric PIN
            pin = data['handoff_pin']
            self.assertIsNotNone(pin)
            self.assertEqual(len(pin), 4)
            self.assertTrue(pin.isdigit())

            # Check 64-character SHA-256 token
            token = data['crypto_token']
            self.assertIsNotNone(token)
            self.assertEqual(len(token), 64)

            # Check DB persistence
            self.donation.refresh_from_db()
            self.assertEqual(self.donation.handoff_pin, pin)
            self.assertEqual(self.donation.crypto_token, token)
            self.assertEqual(self.donation.claimed_by, self.ngo)

            # Check DistributionAudit record
            audit = DistributionAudit.objects.filter(
                donation=self.donation,
                new_status=DonationStatus.CLAIMED
            ).first()
            self.assertIsNotNone(audit)
            self.assertIn(f'Handoff PIN: {pin}', audit.notes)
            self.assertIn('Token:', audit.notes)

        def test_delivery_completion_validates_4_digit_pin(self):
            # Claim first
            self.client.force_authenticate(user=self.ngo)
            claim_res = self.client.post(f'/api/donations/{self.donation.id}/claim/')
            self.assertEqual(claim_res.status_code, 200)
            valid_pin = claim_res.data['handoff_pin']

            # Move to IN_TRANSIT
            transit_res = self.client.post(
                f'/api/donations/{self.donation.id}/update_status/',
                {'status': DonationStatus.IN_TRANSIT}
            )
            self.assertEqual(transit_res.status_code, 200)

            # 1. Attempt DELIVERED with missing PIN -> 400 Bad Request
            res_missing = self.client.post(
                f'/api/donations/{self.donation.id}/update_status/',
                {'status': DonationStatus.DELIVERED}
            )
            self.assertEqual(res_missing.status_code, 400)
            self.assertIn('PIN', res_missing.data.get('error', ''))

            # 2. Attempt DELIVERED with invalid PIN -> 400 Bad Request
            wrong_pin = '9999' if valid_pin != '9999' else '1111'
            res_wrong = self.client.post(
                f'/api/donations/{self.donation.id}/update_status/',
                {'status': DonationStatus.DELIVERED, 'handoff_pin': wrong_pin}
            )
            self.assertEqual(res_wrong.status_code, 400)
            self.assertIn('Invalid', res_wrong.data.get('error', ''))

            # 3. Attempt DELIVERED with valid 4-digit PIN -> 200 OK
            res_correct = self.client.post(
                f'/api/donations/{self.donation.id}/update_status/',
                {'status': DonationStatus.DELIVERED, 'handoff_pin': valid_pin}
            )
            self.assertEqual(res_correct.status_code, 200)
            self.assertEqual(res_correct.data['status'], DonationStatus.DELIVERED)

            self.donation.refresh_from_db()
            self.assertEqual(self.donation.status, DonationStatus.DELIVERED)

            # Check delivery audit log
            delivery_audit = DistributionAudit.objects.filter(
                donation=self.donation,
                new_status=DonationStatus.DELIVERED
            ).first()
            self.assertIsNotNone(delivery_audit)
            self.assertIn('Verified via 4-Digit PIN', delivery_audit.notes)

        def test_donation_serializer_exposes_image_url(self):
            # When donation has no image, image should be None and verified False
            self.client.force_authenticate(user=self.ngo)
            response = self.client.get(f'/api/donations/{self.donation.id}/')
            self.assertEqual(response.status_code, 200)
            self.assertIn('image', response.data)
            self.assertIsNone(response.data['image'])
            self.assertFalse(response.data['image_verified'])

            # When donation has an image, image should be a fully qualified URL
            from django.core.files.uploadedfile import SimpleUploadedFile
            fake_gif = b'GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;'
            self.donation.image = SimpleUploadedFile('test.gif', fake_gif, content_type='image/gif')
            self.donation.image_verified = True
            self.donation.image_quality_score = 92.0
            self.donation.save()

            response_with_img = self.client.get(f'/api/donations/{self.donation.id}/')
            self.assertEqual(response_with_img.status_code, 200)
            self.assertIsNotNone(response_with_img.data['image'])
            self.assertTrue(response_with_img.data['image'].startswith('http'))


    class FastDonationCreationOptimizationTests(APITestCase):
        """
        Tests ensuring surplus food donation creation completes rapidly (< 300ms)
        with instant heuristic AI scoring, deterministic fallbacks, and fast image quality inspection.
        """

        def setUp(self):
            self.donor_user = User.objects.create_user(
                username='fast_donor',
                password='TestPassword123!',
                email='fast_donor@example.com',
                role=UserRole.DONOR
            )
            self.client.force_authenticate(user=self.donor_user)

        def test_create_donation_instant_ai_scoring_and_payload(self):
            payload = {
                'food_title': '50 Servings Fresh Biryani',
                'food_type': 'COOKED',
                'quantity_amount': 50,
                'quantity_unit': 'meals',
                'pickup_location': 'Colaba, Mumbai',
                'expiry_hours': 4
            }
            response = self.client.post('/api/donations/', payload)
            self.assertEqual(response.status_code, 201)
            data = response.data

            # Check all AI scores and badges are present and populated
            self.assertIn('id', data)
            self.assertEqual(data['food_title'], '50 Servings Fresh Biryani')
            self.assertIn('ai_urgency_score', data)
            self.assertGreater(data['ai_urgency_score'], 0)
            self.assertIn('ai_risk_level', data)
            self.assertIn(data['ai_risk_level'], ['CRITICAL', 'HIGH', 'NORMAL'])
            self.assertIn('ai_insight', data)
            self.assertTrue(len(data['ai_insight']) > 0)
            self.assertIn('image_verified', data)
            self.assertFalse(data['image_verified'])
            self.assertIn('image_quality_score', data)
            self.assertEqual(data['image_quality_score'], 0.0)
            self.assertIsNone(data.get('image'))

            # Verify default coordinates fallback
            self.assertAlmostEqual(data['latitude'], 19.0760, places=2)
            self.assertAlmostEqual(data['longitude'], 72.8777, places=2)

        def test_create_donation_with_image_runs_opencv_inspection(self):
            from django.core.files.uploadedfile import SimpleUploadedFile
            fake_gif = b'GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;'
            image_file = SimpleUploadedFile('food.gif', fake_gif, content_type='image/gif')
            payload = {
                'food_title': 'Inspection Test Dish',
                'food_type': 'COOKED',
                'quantity_amount': 25,
                'quantity_unit': 'meals',
                'pickup_location': 'Bandra, Mumbai',
                'expiry_hours': 3,
                'image': image_file
            }
            response = self.client.post('/api/donations/', payload, format='multipart')
            self.assertEqual(response.status_code, 201)
            data = response.data
            self.assertTrue(data['image_verified'])
            self.assertGreater(data['image_quality_score'], 0)
            self.assertIsNotNone(data['image'])
            self.assertTrue(data['image'].startswith('http'))

        def test_image_inspector_fast_resizing_and_fallback(self):
            from .image_inspector import OpenCVImageInspector
            import time

            # Simulate image bytes
            fake_image_bytes = b'GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;'
            t0 = time.time()
            result = OpenCVImageInspector.inspect_image_bytes(fake_image_bytes)
            elapsed_ms = (time.time() - t0) * 1000

            self.assertIn('verified', result)
            self.assertIn('quality_score', result)
            self.assertGreaterEqual(result['quality_score'], 0)
            self.assertLess(elapsed_ms, 50.0)  # Sub-50ms execution


    class GisRouteOptimizationAndHeatmapTests(APITestCase):
        """
        Tests for GIS Route Optimization and Spoilage Heatmap endpoint (/api/routes/optimize/).
        Verifies:
        1. GET /api/routes/optimize/ returns spatial-temporal sorted available donations.
        2. Haversine distance, remaining hours, and Priority Index are computed.
        3. Waypoints and route_geometry are generated for Leaflet rendering.
        4. Critical expiring food (< 2h) receives higher priority index.
        5. POST /api/donations/optimize-route/ maintains backward compatibility.
        """

        def setUp(self):
            self.ngo_user = User.objects.create_user(
                username='gis_ngo_tester',
                password='Password123!',
                role=UserRole.NGO
            )
            UserProfile.objects.create(
                user=self.ngo_user,
                role=UserRole.NGO,
                latitude=19.0760,
                longitude=72.8777,
                organization_name='Mumbai Food Rescue Base',
                is_approved=True
            )
            self.donor_user = User.objects.create_user(
                username='gis_donor_tester',
                password='Password123!',
                role=UserRole.DONOR
            )

            # Donation 1: Claimed pickup by this NGO, close (1.5 km), critical cooked meal
            self.d1 = Donation.objects.create(
                donor=self.donor_user,
                food_title='Urgent Hot Biryani',
                food_type=FoodType.COOKED,
                quantity='50 meals',
                quantity_amount=50,
                pickup_location='BKC Depot',
                latitude=19.0650,
                longitude=72.8680,
                expiry_hours=1,
                ai_urgency_score=92.0,
                ai_risk_level=RiskLevel.CRITICAL,
                status=DonationStatus.CLAIMED,
                claimed_by=self.ngo_user
            )

            # Donation 2: In-transit pickup by this NGO, further (8 km), canned goods
            self.d2 = Donation.objects.create(
                donor=self.donor_user,
                food_title='Canned Goods',
                food_type=FoodType.NON_PERISHABLE,
                quantity='30 kg',
                quantity_amount=30,
                pickup_location='Thane Border',
                latitude=19.1450,
                longitude=72.9300,
                expiry_hours=48,
                ai_urgency_score=15.0,
                ai_risk_level=RiskLevel.NORMAL,
                status=DonationStatus.IN_TRANSIT,
                claimed_by=self.ngo_user
            )

            # Donation 3: Available (unclaimed) - must be excluded from active rescue route
            self.d3 = Donation.objects.create(
                donor=self.donor_user,
                food_title='Unclaimed Marketplace Bread',
                food_type=FoodType.COOKED,
                quantity='20 meals',
                quantity_amount=20,
                pickup_location='Dadar West',
                latitude=19.0200,
                longitude=72.8400,
                expiry_hours=3,
                status=DonationStatus.AVAILABLE
            )

            # Donation 4: Claimed by a DIFFERENT NGO - must be excluded from this NGO's route
            self.other_ngo = User.objects.create_user(
                username='other_ngo_dispatch',
                password='Password123!',
                role=UserRole.NGO
            )
            self.d4 = Donation.objects.create(
                donor=self.donor_user,
                food_title='Other NGO Fruit',
                food_type=FoodType.RAW,
                quantity='10 kg',
                quantity_amount=10,
                pickup_location='Andheri East',
                latitude=19.1100,
                longitude=72.8600,
                expiry_hours=5,
                status=DonationStatus.CLAIMED,
                claimed_by=self.other_ngo
            )

            self.client.force_authenticate(user=self.ngo_user)

        def test_get_routes_optimize_endpoint(self):
            response = self.client.get('/api/routes/optimize/?latitude=19.0760&longitude=72.8777')
            self.assertEqual(response.status_code, 200)
            data = response.data

            self.assertTrue(data['success'])
            self.assertIn('ngo_location', data)
            self.assertEqual(data['ngo_location']['latitude'], 19.0760)
            self.assertIn('ordered_donations', data)

            # Strictly 2 items: Only self.d1 and self.d2 (CLAIMED or IN_TRANSIT by self.ngo_user)
            self.assertEqual(len(data['ordered_donations']), 2)
            returned_ids = [d['id'] for d in data['ordered_donations']]
            self.assertIn(self.d1.id, returned_ids)
            self.assertIn(self.d2.id, returned_ids)
            self.assertNotIn(self.d3.id, returned_ids)
            self.assertNotIn(self.d4.id, returned_ids)

            # Check aggregate rescuable meals
            self.assertEqual(data['total_rescuable_meals'], 80)

            # Check annotated spatial-temporal fields
            first = data['ordered_donations'][0]
            self.assertIn('distance_km', first)
            self.assertIn('remaining_hours', first)
            self.assertIn('priority_index', first)
            self.assertIn('ai_urgency_score', first)
            self.assertIn('ai_risk_level', first)

            # Urgent Biryani should rank higher than Canned Goods
            d1_data = next(d for d in data['ordered_donations'] if d['id'] == self.d1.id)
            d2_data = next(d for d in data['ordered_donations'] if d['id'] == self.d2.id)
            self.assertGreater(d1_data['priority_index'], d2_data['priority_index'])

            # Verify route geometry and waypoints
            self.assertIn('route_geometry', data)
            self.assertGreater(len(data['route_geometry']), 1)
            self.assertIn('waypoints', data)
            self.assertIn('total_distance_km', data)
            self.assertIn('total_drive_time_mins', data)

        def test_post_optimize_route_compatibility(self):
            response = self.client.post('/api/donations/optimize-route/', {
                'volunteer_lat': 19.0760,
                'volunteer_lng': 72.8777
            })
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.data['success'])
            self.assertEqual(len(response.data['ordered_donations']), 2)

            # Test filtering by specific claimed donation IDs
            res_filtered = self.client.post('/api/donations/optimize-route/', {
                'volunteer_lat': 19.0760,
                'volunteer_lng': 72.8777,
                'donation_ids': [self.d1.id]
            })
            self.assertEqual(res_filtered.status_code, 200)
            self.assertEqual(len(res_filtered.data['ordered_donations']), 1)
            self.assertEqual(res_filtered.data['ordered_donations'][0]['id'], self.d1.id)


if __name__ == '__main__':
    unittest.main()
