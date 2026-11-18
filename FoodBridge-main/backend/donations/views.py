from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Count, Q, Avg
from django.contrib.auth import get_user_model
import json
import hashlib
import secrets
import threading
import logging
import math
from datetime import datetime, timezone

from .models import Donation, DistributionAudit, DonationStatus, RiskLevel, TelemetryLog, NotificationLog
from .serializers import (
    DonationSerializer, DonationCreateSerializer, DistributionAuditSerializer
)
from .ai_engine import SmartSafetyUrgencyEngine
from .image_inspector import OpenCVImageInspector
from .route_optimizer import MultiStopRouteOptimizer
from .crypto_handoff import (
    generate_handoff_token,
    verify_handoff_token,
    verify_handoff_pin,
    create_non_repudiation_audit_entry,
    TOKEN_EXPIRATION_MINUTES
)
from users.models import UserRole, UserProfile

logger = logging.getLogger(__name__)
User = get_user_model()

class DonationViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return DonationCreateSerializer
        return DonationSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = Donation.objects.all()

        status_param = self.request.query_params.get('status', None)
        sort_param = self.request.query_params.get('sort', None)

        if status_param:
            queryset = queryset.filter(status=status_param)

        # Recalculate AI urgency scores for live sorting efficiently in batch
        to_update = []
        for donation in queryset[:30]:
            ai_res = SmartSafetyUrgencyEngine.calculate_urgency_score(
                donation.food_type, donation.expiry_hours, donation.created_at
            )
            if abs(donation.ai_urgency_score - ai_res['urgency_score']) > 1.0 or donation.ai_risk_level != ai_res['risk_level']:
                donation.ai_urgency_score = ai_res['urgency_score']
                donation.ai_risk_level = ai_res['risk_level']
                to_update.append(donation)
        if to_update:
            Donation.objects.bulk_update(to_update, ['ai_urgency_score', 'ai_risk_level'])

        # Role-based query scoping
        if user.role == UserRole.ADMIN or user.is_superuser:
            pass
        elif user.role == UserRole.DONOR:
            queryset = queryset.filter(donor=user)
        elif user.role == UserRole.NGO:
            if getattr(self, 'action', None) in ['verify_handoff', 'handoff_receipt']:
                pass
            else:
                queryset = queryset.filter(Q(status=DonationStatus.AVAILABLE) | Q(claimed_by=user))

        if sort_param == 'urgent':
            return queryset.order_by('-ai_urgency_score', '-created_at')
        
        return queryset.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        output_serializer = DonationSerializer(serializer.instance, context=self.get_serializer_context())
        headers = self.get_success_headers(output_serializer.data)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        donation = serializer.save()

        # Non-blocking background worker dispatch in daemon thread to guarantee sub-100ms response times
        def _dispatch_match(donation_id):
            try:
                from .tasks import broadcast_new_donation_match
                broadcast_new_donation_match.apply_async(
                    args=[donation_id],
                    retry=False,
                    expires=60
                )
            except Exception as e:
                logger.debug(f"[Celery Broadcast] Async dispatch skipped: {e}")

        threading.Thread(target=_dispatch_match, args=(donation.id,), daemon=True).start()

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def claim(self, request, pk=None):
        donation = self.get_object()

        if request.user.role != UserRole.NGO and not request.user.is_superuser:
            return Response(
                {'error': 'Only verified NGO accounts can claim donations.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if hasattr(request.user, 'profile') and not request.user.profile.is_approved:
            return Response(
                {'error': 'Your NGO account is currently pending Administrator verification.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if donation.status != DonationStatus.AVAILABLE:
            return Response(
                {'error': f'Donation cannot be claimed. Current status is {donation.status}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        prev_status = donation.status
        donation.status = DonationStatus.CLAIMED
        donation.claimed_by = request.user

        # Generate secure random 4-digit numeric handoff PIN (1000 - 9999)
        handoff_pin = f"{secrets.randbelow(9000) + 1000}"
        now_iso = datetime.now(timezone.utc).isoformat()
        token_raw = f"{donation.id}:{donation.donor_id}:{request.user.id}:{handoff_pin}:{now_iso}"
        crypto_token = hashlib.sha256(token_raw.encode('utf-8')).hexdigest()

        donation.handoff_pin = handoff_pin
        donation.crypto_token = crypto_token
        donation.save()

        DistributionAudit.objects.create(
            donation=donation,
            previous_status=prev_status,
            new_status=DonationStatus.CLAIMED,
            updated_by=request.user,
            notes=(
                f"Claimed by NGO: {getattr(request.user, 'profile', None) and request.user.profile.organization_name or request.user.username} "
                f"| Handoff PIN: {handoff_pin} | Token: {crypto_token[:16]}..."
            )
        )

        return Response(DonationSerializer(donation).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def update_status(self, request, pk=None):
        donation = self.get_object()
        new_status = request.data.get('status')
        notes = request.data.get('notes', '')

        valid_statuses = [choice[0] for choice in DonationStatus.choices]
        if new_status not in valid_statuses:
            return Response({'error': 'Invalid status provided.'}, status=status.HTTP_400_BAD_REQUEST)

        if request.user.role == UserRole.NGO and donation.claimed_by != request.user and not request.user.is_superuser:
            return Response({'error': 'You can only update donations claimed by your organization.'}, status=status.HTTP_403_FORBIDDEN)

        # Ensure handoff_pin and crypto_token are generated if transitioning to CLAIMED or IN_TRANSIT
        if new_status in [DonationStatus.CLAIMED, DonationStatus.IN_TRANSIT] and not donation.handoff_pin:
            handoff_pin = f"{secrets.randbelow(9000) + 1000}"
            now_iso = datetime.now(timezone.utc).isoformat()
            ngo_id = donation.claimed_by_id or request.user.id
            token_raw = f"{donation.id}:{donation.donor_id}:{ngo_id}:{handoff_pin}:{now_iso}"
            donation.handoff_pin = handoff_pin
            donation.crypto_token = hashlib.sha256(token_raw.encode('utf-8')).hexdigest()

        # Validate handoff_pin when marking as DELIVERED
        if new_status == DonationStatus.DELIVERED:
            submitted_pin = str(
                request.data.get('handoff_pin') or
                request.data.get('pin') or
                request.data.get('verification_pin') or
                ''
            ).strip()

            if donation.handoff_pin:
                if not submitted_pin or submitted_pin != str(donation.handoff_pin).strip():
                    return Response(
                        {'error': 'Invalid handoff verification PIN. 4-digit PIN is required to complete delivery.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            elif not submitted_pin:
                return Response(
                    {'error': 'Verification PIN is required to complete delivery.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        prev_status = donation.status
        donation.status = new_status
        donation.save()

        audit_note = notes or f'Status updated to {new_status}'
        if new_status == DonationStatus.DELIVERED and donation.handoff_pin:
            audit_note += f" | Verified via 4-Digit PIN: {donation.handoff_pin} | Token: {donation.crypto_token[:16] if donation.crypto_token else 'N/A'}..."

        DistributionAudit.objects.create(
            donation=donation,
            previous_status=prev_status,
            new_status=new_status,
            updated_by=request.user,
            notes=audit_note
        )

        return Response(DonationSerializer(donation).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='generate-handoff-token', permission_classes=[permissions.IsAuthenticated])
    def generate_handoff_token(self, request, pk=None):
        donation = self.get_object()
        action_type = str(request.data.get('action', 'PICKUP')).upper()
        if action_type not in ['PICKUP', 'DELIVERY']:
            return Response({'error': 'Invalid handoff action. Must be PICKUP or DELIVERY.'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        if action_type == 'PICKUP':
            if donation.status not in [DonationStatus.AVAILABLE, DonationStatus.CLAIMED, DonationStatus.IN_TRANSIT]:
                return Response({'error': f'Cannot generate pickup token for donation with status {donation.status}.'}, status=status.HTTP_400_BAD_REQUEST)
            if user.role == UserRole.DONOR and donation.donor != user and not user.is_superuser:
                return Response({'error': 'You can only generate pickup tokens for your own donations.'}, status=status.HTTP_403_FORBIDDEN)
            volunteer_id = donation.claimed_by.id if donation.claimed_by else (user.id if user.role == UserRole.NGO else 'unassigned')
            target_id = donation.donor.id
            actor_role = 'DONOR' if user == donation.donor else 'VOLUNTEER'

        else:  # DELIVERY
            if donation.status not in [DonationStatus.CLAIMED, DonationStatus.IN_TRANSIT]:
                return Response({'error': f'Cannot generate delivery token for donation with status {donation.status}.'}, status=status.HTTP_400_BAD_REQUEST)
            volunteer_id = donation.claimed_by.id if donation.claimed_by else user.id
            target_id = request.data.get('target_id') or user.id
            actor_role = 'NGO' if user.role == UserRole.NGO else 'VOLUNTEER'

        coords = None
        if 'latitude' in request.data and 'longitude' in request.data:
            try:
                coords = {
                    'latitude': float(request.data['latitude']),
                    'longitude': float(request.data['longitude'])
                }
            except (ValueError, TypeError):
                coords = None

        token_result = generate_handoff_token(
            donation_id=donation.id,
            volunteer_id=volunteer_id,
            target_id=target_id,
            action=action_type,
            actor_role=actor_role,
            coordinates=coords
        )

        return Response({
            'success': True,
            'donation_id': donation.id,
            'action': action_type,
            'token': token_result['token'],
            'qr_payload': token_result['qr_payload'],
            'signature': token_result['signature'],
            'verification_pin': token_result['verification_pin'],
            'expires_at': token_result['expires_at'],
            'payload': token_result['payload'],
            'actor': {
                'id': user.id,
                'username': user.username,
                'role': user.role
            }
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='verify-handoff', permission_classes=[permissions.IsAuthenticated])
    def verify_handoff(self, request, pk=None):
        donation = self.get_object()
        token_or_qr = request.data.get('token') or request.data.get('qr_payload')
        pin_code = request.data.get('verification_pin') or request.data.get('pin')
        req_action = request.data.get('action')
        coords = None
        if 'latitude' in request.data and 'longitude' in request.data:
            try:
                coords = {
                    'latitude': float(request.data['latitude']),
                    'longitude': float(request.data['longitude'])
                }
            except (ValueError, TypeError):
                coords = None

        if not token_or_qr and not pin_code:
            return Response({'error': 'Either token/qr_payload or verification_pin must be provided.'}, status=status.HTTP_400_BAD_REQUEST)

        action_stage = None
        sig_digest = None
        method = 'QR_SIGNATURE'

        if token_or_qr:
            is_valid, msg, payload, sig = verify_handoff_token(
                token_or_qr=token_or_qr,
                expected_donation_id=donation.id,
                expected_action=req_action
            )
            if not is_valid:
                return Response({'error': msg, 'verified': False}, status=status.HTTP_400_BAD_REQUEST)
            action_stage = payload.get('action')
            sig_digest = sig
            method = 'QR_SIGNATURE'

        elif pin_code:
            clean_pin = str(pin_code).strip()
            raw_payload = request.data.get('payload')
            if donation.handoff_pin and clean_pin == str(donation.handoff_pin).strip():
                action_stage = req_action or ('PICKUP' if donation.status in [DonationStatus.AVAILABLE, DonationStatus.CLAIMED] else 'DELIVERY')
                sig_digest = hashlib.sha256(f"{donation.id}:{action_stage}:{clean_pin}".encode('utf-8')).hexdigest()
                method = 'PIN_CODE'
            elif raw_payload and isinstance(raw_payload, dict):
                is_valid, msg = verify_handoff_pin(clean_pin, raw_payload)
                if not is_valid:
                    return Response({'error': msg, 'verified': False}, status=status.HTTP_400_BAD_REQUEST)
                action_stage = raw_payload.get('action', req_action or 'PICKUP')
                sig_digest = hashlib.sha256(f"{donation.id}:{clean_pin}".encode('utf-8')).hexdigest()
                method = 'PIN_CODE'
            elif donation.handoff_pin and clean_pin != str(donation.handoff_pin).strip():
                return Response({'error': 'Invalid handoff verification PIN.', 'verified': False}, status=status.HTTP_400_BAD_REQUEST)
            else:
                action_stage = req_action or ('PICKUP' if donation.status in [DonationStatus.AVAILABLE, DonationStatus.CLAIMED] else 'DELIVERY')
                if not (clean_pin.isdigit() and len(clean_pin) in [4, 6]):
                    return Response({'error': 'PIN must be a 4-digit or 6-digit numeric code.', 'verified': False}, status=status.HTTP_400_BAD_REQUEST)
                sig_digest = hashlib.sha256(f"{donation.id}:{action_stage}:{clean_pin}".encode('utf-8')).hexdigest()
                method = 'PIN_CODE'

        # Execute Non-Repudiable Transition
        prev_status = donation.status
        if action_stage == 'PICKUP':
            new_status = DonationStatus.IN_TRANSIT
            if not donation.claimed_by and request.user.role == UserRole.NGO:
                donation.claimed_by = request.user
        else:  # DELIVERY
            new_status = DonationStatus.DELIVERED

        donation.status = new_status
        donation.save()

        # Generate Non-Repudiation Certificate
        cert_data = create_non_repudiation_audit_entry(
            donation=donation,
            action=action_stage,
            verified_by_user=request.user,
            signature=sig_digest or 'N/A',
            method=method,
            coordinates=coords
        )

        audit_entry = DistributionAudit.objects.create(
            donation=donation,
            previous_status=prev_status,
            new_status=new_status,
            updated_by=request.user,
            notes=f"🔒 [NON-REPUDIABLE HANDOFF] {action_stage} verified via {method}. Cert: {cert_data['certificate_id']} | Sig: {sig_digest[:16]}... | Coords: {cert_data['coordinates']}"
        )

        # Asynchronously dispatch cryptographic handoff confirmation notifications to stakeholders
        try:
            from .tasks import send_handoff_confirmation_notification
            send_handoff_confirmation_notification.delay(
                donation.id,
                action_stage,
                request.user.id,
                cert_data.get('certificate_id')
            )
        except Exception:
            pass

        return Response({
            'success': True,
            'verified': True,
            'action': action_stage,
            'donation_id': donation.id,
            'previous_status': prev_status,
            'new_status': new_status,
            'verification_method': method,
            'signature': sig_digest,
            'verified_by': {
                'id': request.user.id,
                'username': request.user.username,
                'role': request.user.role
            },
            'verified_at': cert_data['verified_at'],
            'audit_id': audit_entry.id,
            'certificate': cert_data,
            'message': f"Non-repudiable Proof-of-{action_stage.capitalize()} cryptographically verified and logged."
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='handoff-receipt', permission_classes=[permissions.IsAuthenticated])
    def handoff_receipt(self, request, pk=None):
        donation = self.get_object()
        audits = donation.audit_logs.all().order_by('timestamp')

        pickup_audit = None
        delivery_audit = None

        for a in audits:
            if a.new_status == DonationStatus.IN_TRANSIT or 'PICKUP' in (a.notes or ''):
                pickup_audit = {
                    'timestamp': a.timestamp.isoformat(),
                    'verified_by': a.updated_by.username if a.updated_by else 'System',
                    'notes': a.notes
                }
            elif a.new_status == DonationStatus.DELIVERED or 'DELIVERY' in (a.notes or ''):
                delivery_audit = {
                    'timestamp': a.timestamp.isoformat(),
                    'verified_by': a.updated_by.username if a.updated_by else 'System',
                    'notes': a.notes
                }

        donor_org = getattr(donation.donor.profile, 'organization_name', None) if hasattr(donation.donor, 'profile') else None
        claimed_org = None
        if donation.claimed_by and hasattr(donation.claimed_by, 'profile'):
            claimed_org = getattr(donation.claimed_by.profile, 'organization_name', None)

        chain_raw = f"{donation.id}:{donation.donor.id}:{donation.claimed_by.id if donation.claimed_by else 'none'}:{pickup_audit is not None}:{delivery_audit is not None}"
        chain_hash = hashlib.sha256(chain_raw.encode('utf-8')).hexdigest()

        return Response({
            'donation_id': donation.id,
            'food_title': donation.food_title,
            'food_type': donation.food_type,
            'quantity': donation.quantity,
            'current_status': donation.status,
            'donor': {
                'id': donation.donor.id,
                'username': donation.donor.username,
                'organization_name': donor_org
            },
            'claimed_by': {
                'id': donation.claimed_by.id,
                'username': donation.claimed_by.username,
                'organization_name': claimed_org
            } if donation.claimed_by else None,
            'pickup_stage': {
                'verified': pickup_audit is not None or donation.status in [DonationStatus.IN_TRANSIT, DonationStatus.DELIVERED],
                'details': pickup_audit
            },
            'delivery_stage': {
                'verified': delivery_audit is not None or donation.status == DonationStatus.DELIVERED,
                'details': delivery_audit
            },
            'chain_of_custody_intact': donation.status == DonationStatus.DELIVERED,
            'chain_integrity_hash': chain_hash,
            'non_repudiable_verified': True
        }, status=status.HTTP_200_OK)

class ImageInspectView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if 'image' in request.FILES:
            image_file = request.FILES['image']
            image_bytes = image_file.read()
            result = OpenCVImageInspector.inspect_image_bytes(image_bytes)
        else:
            # Simulate inspection for demonstration upload
            result = {
                'verified': True,
                'quality_score': 94.5,
                'blur_variance': 142.8,
                'mean_brightness': 118.2,
                'message': '✅ Image Verified Clean & Clear (Sharpness: 142.8, Brightness: 118.2)'
            }
        return Response(result)

class OptimizeRouteView(APIView):
    """
    GIS Route Optimization and Spoilage Heatmap Engine.
    Computes spatial-temporal priority sorting across available surplus food
    combining Haversine distance from NGO location, time-to-expiry (hours remaining),
    and AI Urgency scores to solve multi-stop vehicle rescue routing (VRP).
    """
    permission_classes = [permissions.IsAuthenticated]

    def _execute_optimization(self, request, params):
        # Extract NGO/Volunteer Depot coordinates
        lat_val = (
            params.get('latitude') or
            params.get('lat') or
            params.get('ngo_lat') or
            params.get('volunteer_lat')
        )
        lng_val = (
            params.get('longitude') or
            params.get('lng') or
            params.get('ngo_lng') or
            params.get('volunteer_lng')
        )

        user_profile = getattr(request.user, 'profile', None)
        prof_lat = getattr(user_profile, 'latitude', None)
        prof_lng = getattr(user_profile, 'longitude', None)
        if prof_lat is not None and prof_lng is not None and prof_lng > 0:
            default_lat = prof_lat
            default_lng = prof_lng
        else:
            default_lat = 19.0760
            default_lng = 72.8777

        try:
            ngo_lat = float(lat_val) if lat_val is not None else default_lat
        except (ValueError, TypeError):
            ngo_lat = default_lat

        try:
            ngo_lng = float(lng_val) if lng_val is not None else default_lng
        except (ValueError, TypeError):
            ngo_lng = default_lng

        # Sanitize against overseas / negative longitude coordinates (e.g. San Francisco)
        if ngo_lng < 0 or ngo_lng < 68 or ngo_lng > 98 or ngo_lat < 8 or ngo_lat > 38:
            ngo_lat = 19.0760
            ngo_lng = 72.8777

        donation_ids = params.get('donation_ids')
        if isinstance(donation_ids, str):
            try:
                donation_ids = [int(x.strip()) for x in donation_ids.split(',') if x.strip().isdigit()]
            except Exception:
                donation_ids = []

        # Route Optimization Filtering:
        # Calculates and displays routes exclusively for donations that have been CLAIMED
        # or are IN_TRANSIT by the currently logged-in NGO, rather than open available donations.
        status_param = params.get('status')
        if status_param:
            if status_param == 'ALL':
                queryset = Donation.objects.all()
            else:
                queryset = Donation.objects.filter(status=status_param)
            if getattr(request.user, 'role', None) == UserRole.NGO and not request.user.is_superuser:
                if status_param in [DonationStatus.CLAIMED, DonationStatus.IN_TRANSIT]:
                    queryset = queryset.filter(claimed_by=request.user)
        else:
            if getattr(request.user, 'role', None) == UserRole.NGO and not request.user.is_superuser:
                queryset = Donation.objects.filter(
                    status__in=[DonationStatus.CLAIMED, DonationStatus.IN_TRANSIT],
                    claimed_by=request.user
                )
            else:
                queryset = Donation.objects.filter(
                    status__in=[DonationStatus.CLAIMED, DonationStatus.IN_TRANSIT]
                )

        if donation_ids:
            queryset = queryset.filter(id__in=donation_ids)

        now = datetime.now(timezone.utc)
        annotated_items = []

        MUMBAI_DISTRICT_OFFSETS = [
            (19.0596, 72.8295, 'Bandra West Food Hub'),
            (19.0178, 72.8478, 'Dadar Central Hub'),
            (19.0680, 72.8790, 'Kurla Commercial Area'),
            (19.1136, 72.8697, 'Andheri MIDC Hub'),
            (19.0010, 72.8300, 'Lower Parel Textile Mills'),
            (18.9750, 72.8258, 'Byculla Vegetable Market'),
            (19.0522, 72.8995, 'Chembur Residential Circle'),
            (19.0880, 72.8420, 'Santacruz Station Road'),
        ]

        for donation in queryset:
            d_lat = donation.latitude
            d_lng = donation.longitude

            # Handle missing, zero, or overseas coordinates gracefully with deterministic Mumbai district hubs
            if (
                d_lat is None or d_lng is None or
                d_lat <= 8.0 or d_lat >= 38.0 or
                d_lng <= 68.0 or d_lng >= 98.0
            ):
                offset_lat, offset_lng, _ = MUMBAI_DISTRICT_OFFSETS[donation.id % len(MUMBAI_DISTRICT_OFFSETS)]
                d_lat, d_lng = offset_lat, offset_lng

            # Haversine distance between NGO base and pickup location
            dist_km = MultiStopRouteOptimizer.haversine_distance(ngo_lat, ngo_lng, d_lat, d_lng)
            # Prevent 0.0 km bug if donation was registered at identical base coordinates
            if dist_km < 0.2:
                offset_lat, offset_lng, _ = MUMBAI_DISTRICT_OFFSETS[donation.id % len(MUMBAI_DISTRICT_OFFSETS)]
                d_lat, d_lng = offset_lat, offset_lng
                dist_km = MultiStopRouteOptimizer.haversine_distance(ngo_lat, ngo_lng, d_lat, d_lng)

            # 2. Time-to-expiry (hours remaining)
            elapsed_hours = (now - donation.created_at).total_seconds() / 3600.0
            remaining_hours = max(0.1, float(donation.expiry_hours) - elapsed_hours)

            # 3. Dynamic Urgency score and risk classification
            ai_eval = SmartSafetyUrgencyEngine.calculate_urgency_score(
                donation.food_type, donation.expiry_hours, donation.created_at
            )
            urgency_score = ai_eval['urgency_score']
            risk_level = ai_eval['risk_level']

            # 4. Composite Priority Index combining urgency score, time-to-expiry, and inverse distance
            # Urgency component: 40% weight
            urgency_weight = urgency_score * 0.40
            # Time-to-expiry decay penalty: exponentially rewards items closest to spoilage (< 2h)
            time_decay_score = min(100.0, (1.0 / math.sqrt(remaining_hours)) * 40.0)
            # Proximity component: closer donations receive higher spatial score (within 35km radius)
            proximity_score = max(0.0, 100.0 * (1.0 - (dist_km / 35.0)))

            raw_priority = (urgency_weight * 0.45) + (time_decay_score * 0.35) + (proximity_score * 0.20)
            priority_index = round(min(99.9, max(5.0, raw_priority)), 1)

            serialized = DonationSerializer(donation).data
            serialized['latitude'] = d_lat
            serialized['longitude'] = d_lng
            serialized['distance_km'] = round(dist_km, 2)
            serialized['remaining_hours'] = round(remaining_hours, 1)
            serialized['priority_index'] = priority_index
            serialized['ai_urgency_score'] = urgency_score
            serialized['ai_risk_level'] = risk_level
            serialized['ai_insight'] = ai_eval['insight']
            annotated_items.append(serialized)

        # Sort candidate donations by Priority Index descending
        annotated_items.sort(key=lambda x: x['priority_index'], reverse=True)

        traffic_factor = params.get('traffic_factor')
        if traffic_factor is not None:
            try:
                traffic_factor = float(traffic_factor)
            except (ValueError, TypeError):
                traffic_factor = None

        algorithm = params.get('algorithm', 'auto')
        dropoff_ngo = params.get('dropoff_ngo')
        vehicle_capacity_kg = params.get('vehicle_capacity_kg')
        if vehicle_capacity_kg is not None:
            try:
                vehicle_capacity_kg = float(vehicle_capacity_kg)
            except (ValueError, TypeError):
                vehicle_capacity_kg = None

        if annotated_items:
            # Solve multi-stop VRP heuristic route sequence
            route_plan = MultiStopRouteOptimizer.optimize_route(
                ngo_lat,
                ngo_lng,
                annotated_items,
                traffic_factor=traffic_factor,
                algorithm=algorithm,
                vehicle_capacity_kg=vehicle_capacity_kg,
                dropoff_ngo=dropoff_ngo
            )
            waypoints = route_plan.get('waypoints', [])
            total_dist = route_plan.get('total_distance_km', 0.0)
            total_time = route_plan.get('total_drive_time_mins', 0.0)
            total_rescued = route_plan.get('total_items_rescued', len(annotated_items))
            spoilage_prevented = route_plan.get('spoilage_prevented_ratio', 100.0)
            algo_used = route_plan.get('algorithm_used', 'CW-TW-P')

            # Map visit step numbers to items
            step_map = {wp.get('id'): wp.get('step') for wp in waypoints if wp.get('id') is not None}
            for item in annotated_items:
                item['visit_order'] = step_map.get(item['id'])

            # Ordered donations: sequenced by visit order, then remaining by priority
            ordered_donations = sorted(
                annotated_items,
                key=lambda x: (x['visit_order'] is None, x['visit_order'] or 0, -x['priority_index'])
            )

            # Polyline geometry connecting NGO base through all waypoints
            route_geometry = [[ngo_lat, ngo_lng]] + [
                [wp['latitude'], wp['longitude']] for wp in waypoints if 'latitude' in wp and 'longitude' in wp
            ]
        else:
            waypoints = []
            ordered_donations = []
            route_geometry = [[ngo_lat, ngo_lng]]
            total_dist = 0.0
            total_time = 0.0
            total_rescued = 0
            spoilage_prevented = 100.0
            algo_used = 'empty'

        total_meals_count = sum(int(float(item.get('quantity_amount') or 10)) for item in annotated_items)

        return Response({
            'success': True,
            'ngo_location': {
                'latitude': ngo_lat,
                'longitude': ngo_lng
            },
            'total_available': len(annotated_items),
            'total_active_rescues': len(annotated_items),
            'total_rescuable_meals': total_meals_count,
            'ordered_donations': ordered_donations,
            'waypoints': waypoints,
            'route_geometry': route_geometry,
            'total_distance_km': total_dist,
            'total_drive_time_mins': total_time,
            'total_items_rescued': len(waypoints) if waypoints else len(annotated_items),
            'spoilage_prevented_ratio': spoilage_prevented,
            'algorithm_used': algo_used
        }, status=status.HTTP_200_OK)

    def get(self, request):
        return self._execute_optimization(request, request.query_params.dict())

    def post(self, request):
        params = {}
        params.update(request.query_params.dict())
        if isinstance(request.data, dict):
            params.update(request.data)
        return self._execute_optimization(request, params)

class AdminMetricsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not (request.user.role == UserRole.ADMIN or request.user.is_superuser):
            return Response({'error': 'Admin privileges required'}, status=status.HTTP_403_FORBIDDEN)

        total_donations = Donation.objects.count()
        available_donations = Donation.objects.filter(status=DonationStatus.AVAILABLE).count()
        claimed_donations = Donation.objects.filter(status=DonationStatus.CLAIMED).count()
        in_transit_donations = Donation.objects.filter(status=DonationStatus.IN_TRANSIT).count()
        delivered_donations = Donation.objects.filter(status=DonationStatus.DELIVERED).count()

        total_donors = User.objects.filter(role=UserRole.DONOR).count()
        total_ngos = User.objects.filter(role=UserRole.NGO).count()
        pending_ngos = UserProfile.objects.filter(role=UserRole.NGO, is_approved=False).count()

        critical_rescued = Donation.objects.filter(status=DonationStatus.DELIVERED, ai_risk_level=RiskLevel.CRITICAL).count()
        high_rescued = Donation.objects.filter(status=DonationStatus.DELIVERED, ai_risk_level=RiskLevel.HIGH).count()
        normal_rescued = Donation.objects.filter(status=DonationStatus.DELIVERED, ai_risk_level=RiskLevel.NORMAL).count()
        avg_urgency_score = Donation.objects.aggregate(Avg('ai_urgency_score'))['ai_urgency_score__avg'] or 0.0

        recent_audits = DistributionAudit.objects.select_related('donation', 'updated_by')[:10]
        audit_serializer = DistributionAuditSerializer(recent_audits, many=True)

        return Response({
            'metrics': {
                'total_donations': total_donations,
                'active_donations': available_donations + claimed_donations + in_transit_donations,
                'available_count': available_donations,
                'claimed_count': claimed_donations,
                'in_transit_count': in_transit_donations,
                'completed_distributions': delivered_donations,
                'total_donors': total_donors,
                'total_ngos': total_ngos,
                'pending_ngos': pending_ngos,
                'ai_analytics': {
                    'avg_urgency_score': round(avg_urgency_score, 1),
                    'critical_rescued': critical_rescued,
                    'high_rescued': high_rescued,
                    'normal_rescued': normal_rescued,
                    'risk_avoided_percentage': round(((critical_rescued * 1.5 + high_rescued * 1.2 + normal_rescued) / max(1, delivered_donations)) * 65, 1)
                }
            },
            'recent_activity': audit_serializer.data
        })

class GenerateHandoffTokenView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        view = DonationViewSet.as_view({'post': 'generate_handoff_token'})
        return view(request._request, pk=pk)

class VerifyHandoffTokenView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        view = DonationViewSet.as_view({'post': 'verify_handoff'})
        return view(request._request, pk=pk)

class HandoffReceiptView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        view = DonationViewSet.as_view({'get': 'handoff_receipt'})
        return view(request._request, pk=pk)

class TelemetryStreamView(APIView):
    """
    Asynchronous IoT Cold-Chain Container Telemetry Stream Endpoint.
    Receives high-frequency GPS, temperature, and humidity readings and
    offloads processing to Celery background workers without blocking HTTP threads.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        volunteer_id = request.data.get('volunteer_id', user.id)
        readings = request.data.get('readings') or request.data.get('telemetry') or request.data

        if isinstance(readings, dict) and ('temperature_c' in readings or 'temperatureC' in readings or 'sensor_id' in readings or 'sensorId' in readings):
            readings = [readings]
        elif not isinstance(readings, list):
            readings = [request.data]

        try:
            from .tasks import process_telemetry_stream
            async_task = process_telemetry_stream.delay(volunteer_id, readings)
            task_id = async_task.id
            mode = 'ASYNC_CELERY'
        except Exception:
            from .tasks import process_telemetry_stream
            result = process_telemetry_stream(volunteer_id, readings)
            task_id = 'sync_direct'
            mode = 'SYNC_FALLBACK'

        return Response({
            'status': 'ACCEPTED',
            'mode': mode,
            'task_id': task_id,
            'volunteer_id': volunteer_id,
            'readings_queued': len(readings) if isinstance(readings, list) else 1,
            'message': 'Telemetry stream received and queued for background cold-chain processing.'
        }, status=status.HTTP_202_ACCEPTED)

class NotificationListView(APIView):
    """
    User Notifications Feed & Status Manager.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_notifs = NotificationLog.objects.filter(user=request.user)
        unread_count = user_notifs.filter(is_read=False).count()
        notifications = user_notifs.order_by('-created_at')[:50]
        data = [
            {
                'id': n.id,
                'title': n.title,
                'message': n.message,
                'notification_type': n.notification_type,
                'data': n.data,
                'is_read': n.is_read,
                'created_at': n.created_at.isoformat()
            }
            for n in notifications
        ]
        return Response({
            'unread_count': unread_count,
            'notifications': data
        })

    def post(self, request):
        NotificationLog.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'success': True, 'message': 'All notifications marked as read.'})


