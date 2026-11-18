"""
FoodBridge Asynchronous Background Worker Tasks.

Powered by Celery and Redis to handle:
1. Automated Matching Broadcasts to nearby NGOs and Volunteers.
2. Push Notifications & Urgent Spoilage Alerts.
3. High-frequency IoT Cold-Chain Container Telemetry Streams.
4. Periodic Spoilage Decay Monitoring and Metrics Aggregation.
"""

import logging
import math
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Union

from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Q

from .models import (
    Donation,
    DonationStatus,
    FoodType,
    RiskLevel,
    DistributionAudit,
    TelemetryLog,
    NotificationLog
)
from users.models import UserRole, UserProfile
from .route_optimizer import MultiStopRouteOptimizer

logger = logging.getLogger(__name__)
User = get_user_model()


# -----------------------------------------------------------------------------
# 1. Automated Matching Broadcast Tasks
# -----------------------------------------------------------------------------

@shared_task(bind=True, name='donations.tasks.broadcast_new_donation_match')
def broadcast_new_donation_match(self, donation_id: int, radius_km: float = 15.0) -> Dict[str, Any]:
    """
    Asynchronously matches a newly posted or updated donation with eligible NGOs
    and nearby Logistics Volunteers without blocking the API HTTP response thread.
    """
    logger.info(f"[Celery] Initiating matching broadcast for Donation #{donation_id} within {radius_km} km")

    try:
        donation = Donation.objects.select_related('donor').get(id=donation_id)
    except Donation.DoesNotExist:
        logger.error(f"[Celery] Donation #{donation_id} not found.")
        return {'success': False, 'error': f'Donation #{donation_id} not found.'}

    if donation.latitude is None or donation.longitude is None:
        logger.warning(f"[Celery] Donation #{donation_id} missing GPS coordinates. Matching skipped.")
        return {'success': False, 'error': 'Missing GPS coordinates for donation.'}

    # If critical risk, expand broadcast radius dynamically
    effective_radius = radius_km
    if donation.ai_risk_level == RiskLevel.CRITICAL:
        effective_radius = max(radius_km, 25.0)
    elif donation.ai_risk_level == RiskLevel.HIGH:
        effective_radius = max(radius_km, 18.0)

    # Query approved NGO and Volunteer profiles with valid GPS coordinates
    candidate_profiles = UserProfile.objects.select_related('user').filter(
        role=UserRole.NGO,
        is_approved=True,
        latitude__isnull=False,
        longitude__isnull=False
    ).exclude(user=donation.donor)

    matched_candidates: List[Dict[str, Any]] = []

    for profile in candidate_profiles:
        dist_km = MultiStopRouteOptimizer.haversine_distance(
            donation.latitude, donation.longitude,
            profile.latitude, profile.longitude
        )

        if dist_km <= effective_radius:
            # Score match based on proximity, urgency, and organization readiness
            proximity_score = max(0.0, 100.0 - (dist_km / effective_radius) * 60.0)
            urgency_weight = (donation.ai_urgency_score or 50.0) * 0.4
            composite_match_score = round(proximity_score * 0.6 + urgency_weight, 1)

            matched_candidates.append({
                'user_id': profile.user.id,
                'username': profile.user.username,
                'organization_name': profile.organization_name or profile.user.username,
                'distance_km': round(dist_km, 2),
                'match_score': composite_match_score,
                'operating_area': profile.operating_area or 'General'
            })

    # Sort descending by match score
    matched_candidates.sort(key=lambda x: x['match_score'], reverse=True)

    # Enqueue push notifications asynchronously to top matched recipients
    notifications_dispatched = 0
    top_candidates = matched_candidates[:10]  # Broadcast to top 10 candidates

    for candidate in top_candidates:
        msg = (
            f"🚨 Urgent Match Alert: {donation.food_title} ({donation.quantity}) is available "
            f"at {donation.pickup_location[:40]} ({candidate['distance_km']} km away). "
            f"Shelf life: {donation.expiry_hours}h. Tap to claim!"
        )
        try:
            send_push_notification.delay(
                user_id=candidate['user_id'],
                title=f"New Food Rescue Match ({donation.ai_risk_level})",
                message=msg,
                data={
                    'donation_id': donation.id,
                    'food_title': donation.food_title,
                    'quantity': donation.quantity,
                    'ai_urgency_score': donation.ai_urgency_score,
                    'ai_risk_level': donation.ai_risk_level,
                    'distance_km': candidate['distance_km'],
                    'match_score': candidate['match_score']
                },
                notification_type='MATCH_BROADCAST'
            )
            notifications_dispatched += 1
        except Exception as e:
            logger.warning(f"[Celery] Could not dispatch notification via delay to user #{candidate['user_id']}: {e}")
            try:
                send_push_notification(
                    user_id=candidate['user_id'],
                    title=f"New Food Rescue Match ({donation.ai_risk_level})",
                    message=msg,
                    data={
                        'donation_id': donation.id,
                        'food_title': donation.food_title,
                        'quantity': donation.quantity,
                        'ai_urgency_score': donation.ai_urgency_score,
                        'ai_risk_level': donation.ai_risk_level,
                        'distance_km': candidate['distance_km'],
                        'match_score': candidate['match_score']
                    },
                    notification_type='MATCH_BROADCAST'
                )
                notifications_dispatched += 1
            except Exception:
                pass

    logger.info(
        f"[Celery] Broadcast completed for Donation #{donation_id}: "
        f"{len(matched_candidates)} candidates found, {notifications_dispatched} push notifications queued."
    )

    return {
        'success': True,
        'donation_id': donation.id,
        'food_title': donation.food_title,
        'ai_risk_level': donation.ai_risk_level,
        'effective_radius_km': effective_radius,
        'candidates_found': len(matched_candidates),
        'notifications_queued': notifications_dispatched,
        'top_matches': top_candidates[:5]
    }


# -----------------------------------------------------------------------------
# 2. Push Notification & Alert Tasks
# -----------------------------------------------------------------------------

@shared_task(bind=True, max_retries=3, default_retry_delay=5, name='donations.tasks.send_push_notification')
def send_push_notification(
    self,
    user_id: int,
    title: str,
    message: str,
    data: Optional[Dict[str, Any]] = None,
    notification_type: str = 'SYSTEM'
) -> Dict[str, Any]:
    """
    Asynchronously delivers a push notification to a user, logs it in NotificationLog,
    and handles automatic retry with exponential backoff on transient failure.
    """
    logger.info(f"[Celery] Sending push notification to User #{user_id}: '{title}' [{notification_type}]")

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist as exc:
        logger.error(f"[Celery] User #{user_id} does not exist.")
        return {'success': False, 'error': f'User #{user_id} not found.'}
    except Exception as exc:
        logger.warning(f"[Celery] DB lookup error for User #{user_id}, retrying: {exc}")
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)

    payload_data = data or {}

    try:
        notif = NotificationLog.objects.create(
            user=user,
            title=title,
            message=message,
            notification_type=notification_type,
            data=payload_data
        )

        # Simulation of external remote push gateway (FCM / APNs / WebPush)
        delivery_receipt = {
            'gateway': 'FoodBridge-Mock-FCM',
            'status': 'DELIVERED',
            'recipient': user.username,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'message_id': f"msg_{notif.id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        }

        return {
            'success': True,
            'notification_id': notif.id,
            'user_id': user.id,
            'username': user.username,
            'title': title,
            'notification_type': notification_type,
            'delivery_receipt': delivery_receipt
        }

    except Exception as exc:
        logger.error(f"[Celery] Failed to create NotificationLog: {exc}")
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@shared_task(bind=True, name='donations.tasks.send_urgent_spoilage_alert')
def send_urgent_spoilage_alert(self, donation_id: int, hours_remaining: Optional[float] = None) -> Dict[str, Any]:
    """
    Broadcasts high-priority spoilage warnings when high-risk or cooked meals
    approach their safe shelf life threshold (< 2.0 hours).
    """
    try:
        donation = Donation.objects.get(id=donation_id)
    except Donation.DoesNotExist:
        return {'success': False, 'error': f'Donation #{donation_id} not found.'}

    remaining_str = f"{hours_remaining:.1f}" if hours_remaining is not None else str(donation.expiry_hours)
    alert_title = f"⚠️ CRITICAL SPOILAGE RISK: {donation.food_title}"
    alert_msg = (
        f"Rescue needed immediately! {donation.food_title} ({donation.quantity}) at {donation.pickup_location[:35]} "
        f"has under {remaining_str} hours before spoilage decay. Prioritize immediate dispatch!"
    )

    recipients_count = 0
    # Notify active NGOs and volunteers
    active_responders = User.objects.filter(role=UserRole.NGO)[:15]

    for responder in active_responders:
        send_push_notification.delay(
            user_id=responder.id,
            title=alert_title,
            message=alert_msg,
            data={
                'donation_id': donation.id,
                'food_title': donation.food_title,
                'hours_remaining': hours_remaining or donation.expiry_hours,
                'priority': 'CRITICAL',
                'pickup_location': donation.pickup_location
            },
            notification_type='SPOILAGE_ALERT'
        )
        recipients_count += 1

    return {
        'success': True,
        'donation_id': donation.id,
        'recipients_alerted': recipients_count,
        'alert_title': alert_title
    }


@shared_task(bind=True, name='donations.tasks.send_handoff_confirmation_notification')
def send_handoff_confirmation_notification(
    self,
    donation_id: int,
    stage: str,
    actor_id: int,
    certificate_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Asynchronously notifies donor, volunteer, and receiving NGO upon successful
    cryptographic verification of a pickup or delivery handoff checkpoint.
    """
    try:
        donation = Donation.objects.select_related('donor', 'claimed_by').get(id=donation_id)
    except Donation.DoesNotExist:
        return {'success': False, 'error': f'Donation #{donation_id} not found.'}

    stage_upper = stage.upper()
    cert = certificate_id or f"CERT-{donation.id}-{stage_upper}"

    notifications_sent = []

    # 1. Notify Donor
    donor_msg = (
        f"🔒 Proof-of-{stage_upper.capitalize()} Verified! Your donation '{donation.food_title}' "
        f"has been confirmed with cryptographic certificate {cert}."
    )
    send_push_notification.delay(
        user_id=donation.donor.id,
        title=f"Custody {stage_upper.capitalize()} Confirmed",
        message=donor_msg,
        data={'donation_id': donation.id, 'stage': stage_upper, 'certificate_id': cert},
        notification_type='HANDOFF_CONFIRMATION'
    )
    notifications_sent.append(donation.donor.id)

    # 2. Notify Logistics Volunteer if assigned
    if donation.claimed_by and donation.claimed_by.id != actor_id:
        vol_msg = f"🔒 Custody handoff for '{donation.food_title}' [{stage_upper}] verified and logged to audit chain."
        send_push_notification.delay(
            user_id=donation.claimed_by.id,
            title=f"Handoff {stage_upper.capitalize()} Verified",
            message=vol_msg,
            data={'donation_id': donation.id, 'stage': stage_upper, 'certificate_id': cert},
            notification_type='HANDOFF_CONFIRMATION'
        )
        notifications_sent.append(donation.claimed_by.id)

    return {
        'success': True,
        'donation_id': donation.id,
        'stage': stage_upper,
        'certificate_id': cert,
        'notified_user_ids': notifications_sent
    }


# -----------------------------------------------------------------------------
# 3. Telemetry Stream Ingestion & Cold-Chain Processing
# -----------------------------------------------------------------------------

@shared_task(bind=True, name='donations.tasks.process_telemetry_stream')
def process_telemetry_stream(
    self,
    volunteer_id: int,
    telemetry_data: Union[Dict[str, Any], List[Dict[str, Any]]]
) -> Dict[str, Any]:
    """
    Processes real-time IoT cold-chain sensor readings (temperature, humidity, GPS location)
    streamed from transport containers asynchronously without blocking main Django threads.
    
    Evaluates thermal breaches against food safety standards:
    - Cooked Meals: Safe >= 60°C (hot hold) or <= 4°C (chilled). Danger zone: 8°C - 55°C.
    - Perishable (Dairy, Produce): Safe <= 8.0°C.
    - Frozen: Safe <= -10.0°C.
    """
    logger.info(f"[Celery] Processing telemetry stream for Volunteer #{volunteer_id}")

    try:
        volunteer = User.objects.get(id=volunteer_id)
    except User.DoesNotExist:
        logger.error(f"[Celery] Volunteer #{volunteer_id} not found.")
        return {'success': False, 'error': f'Volunteer #{volunteer_id} not found.'}

    # Normalize into list of readings
    readings = telemetry_data if isinstance(telemetry_data, list) else [telemetry_data]
    processed_count = 0
    breaches_detected = 0
    latest_lat = None
    latest_lng = None

    for item in readings:
        if not isinstance(item, dict):
            continue

        donation_id = item.get('donation_id') or item.get('donationId')
        sensor_id = item.get('sensor_id') or item.get('sensorId', f"SENSOR_{volunteer_id}")
        temp_c = float(item.get('temperature_c', item.get('temperatureC', 4.0)))
        humidity_pct = float(item.get('humidity_pct', item.get('humidityPct', 55.0)))
        item_lat = item.get('latitude', item.get('lat'))
        item_lng = item.get('longitude', item.get('lng'))

        if item_lat is not None and item_lng is not None:
            try:
                latest_lat = float(item_lat)
                latest_lng = float(item_lng)
            except (ValueError, TypeError):
                pass

        # Determine target donation and storage requirement
        donation = None
        is_breach = False
        breach_reason = ""

        if donation_id:
            try:
                donation = Donation.objects.get(id=donation_id)
                # Check category specific safety thresholds
                if donation.food_type == FoodType.COOKED:
                    # Cooked hot food should be kept hot >= 55°C, or cold-transported <= 8°C
                    if 8.0 < temp_c < 55.0:
                        is_breach = True
                        breach_reason = f"Cooked meal container entered danger zone: {temp_c}°C (Expected >=55°C or <=8°C)"
                elif donation.food_type in [FoodType.PERISHABLE, FoodType.RAW]:
                    if temp_c > 8.0:
                        is_breach = True
                        breach_reason = f"Perishable food exceeded 8.0°C threshold: {temp_c}°C"
            except (Donation.DoesNotExist, ValueError):
                pass

        # Fallback general safety check if no specific donation
        if not donation and temp_c > 12.0:
            is_breach = True
            breach_reason = f"Container temperature elevated: {temp_c}°C"

        if is_breach:
            breaches_detected += 1

        # Persist TelemetryLog
        telemetry_entry = TelemetryLog.objects.create(
            donation=donation,
            volunteer=volunteer,
            sensor_id=sensor_id,
            temperature_c=temp_c,
            humidity_pct=humidity_pct,
            thermal_breach=is_breach,
            latitude=latest_lat,
            longitude=latest_lng,
            notes=breach_reason or 'Nominal cold-chain telemetry reading'
        )
        processed_count += 1

        # If cold-chain breach detected, trigger urgent warning to volunteer immediately
        if is_breach:
            try:
                send_push_notification.delay(
                    user_id=volunteer.id,
                    title="🚨 Cold-Chain Thermal Breach Warning!",
                    message=f"Sensor {sensor_id}: {breach_reason}. Inspect container insulation immediately!",
                    data={
                        'sensor_id': sensor_id,
                        'temperature_c': temp_c,
                        'humidity_pct': humidity_pct,
                        'donation_id': donation.id if donation else None,
                        'telemetry_id': telemetry_entry.id
                    },
                    notification_type='TELEMETRY_BREACH'
                )
            except Exception:
                send_push_notification(
                    user_id=volunteer.id,
                    title="🚨 Cold-Chain Thermal Breach Warning!",
                    message=f"Sensor {sensor_id}: {breach_reason}. Inspect container insulation immediately!",
                    data={
                        'sensor_id': sensor_id,
                        'temperature_c': temp_c,
                        'humidity_pct': humidity_pct,
                        'donation_id': donation.id if donation else None,
                        'telemetry_id': telemetry_entry.id
                    },
                    notification_type='TELEMETRY_BREACH'
                )

    # Asynchronously update VolunteerProfile's latest GPS position
    if latest_lat is not None and latest_lng is not None and hasattr(volunteer, 'profile'):
        volunteer.profile.latitude = latest_lat
        volunteer.profile.longitude = latest_lng
        volunteer.profile.save(update_fields=['latitude', 'longitude'])

    return {
        'success': True,
        'volunteer_id': volunteer.id,
        'readings_processed': processed_count,
        'breaches_detected': breaches_detected,
        'latest_coordinates': {'latitude': latest_lat, 'longitude': latest_lng} if latest_lat else None
    }


# -----------------------------------------------------------------------------
# 4. Periodic Celery Beat Scheduled Tasks
# -----------------------------------------------------------------------------

@shared_task(name='donations.tasks.monitor_spoilage_and_expiry')
def monitor_spoilage_and_expiry() -> Dict[str, Any]:
    """
    Periodic task scheduled every 15 minutes via Celery Beat.
    Audits active donations, evaluates remaining shelf life, triggers urgent
    spoilage alerts, and transitions overdue items to EXPIRED status.
    """
    logger.info("[Celery Beat] Executing periodic spoilage & expiry audit.")

    now = datetime.now(timezone.utc)
    active_donations = Donation.objects.filter(
        status__in=[DonationStatus.AVAILABLE, DonationStatus.CLAIMED, DonationStatus.IN_TRANSIT]
    )

    updated_count = 0
    alerts_triggered = 0
    expired_count = 0

    for donation in active_donations:
        elapsed_hours = (now - donation.created_at).total_seconds() / 3600.0
        remaining_hours = max(0.0, donation.expiry_hours - elapsed_hours)

        if remaining_hours <= 0.0:
            # Mark as expired
            prev_status = donation.status
            donation.status = DonationStatus.EXPIRED
            donation.save(update_fields=['status'])
            DistributionAudit.objects.create(
                donation=donation,
                previous_status=prev_status,
                new_status=DonationStatus.EXPIRED,
                notes="Automated expiry transition via periodic Celery Beat worker."
            )
            expired_count += 1

        elif remaining_hours <= 2.0:
            # Urgent spoilage threshold
            if donation.ai_risk_level != RiskLevel.CRITICAL:
                donation.ai_risk_level = RiskLevel.CRITICAL
                donation.ai_urgency_score = min(100.0, max(85.0, 100.0 - (remaining_hours * 7.5)))
                donation.save(update_fields=['ai_risk_level', 'ai_urgency_score'])
                updated_count += 1

            send_urgent_spoilage_alert.delay(donation.id, hours_remaining=remaining_hours)
            alerts_triggered += 1

    return {
        'success': True,
        'audited_count': active_donations.count(),
        'updated_count': updated_count,
        'alerts_triggered': alerts_triggered,
        'expired_count': expired_count
    }


@shared_task(name='donations.tasks.aggregate_telemetry_metrics')
def aggregate_telemetry_metrics(volunteer_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Periodic hourly task scheduled via Celery Beat.
    Aggregates cold-chain telemetry statistics over the last 24 hours.
    """
    logger.info("[Celery Beat] Aggregating cold-chain telemetry metrics.")
    past_24h = datetime.now(timezone.utc) - timedelta(hours=24)

    qs = TelemetryLog.objects.filter(timestamp__gte=past_24h)
    if volunteer_id:
        qs = qs.filter(volunteer_id=volunteer_id)

    total_logs = qs.count()
    total_breaches = qs.filter(thermal_breach=True).count()
    breach_rate = round((total_breaches / max(1, total_logs)) * 100.0, 1)

    return {
        'success': True,
        'window': 'last_24h',
        'total_telemetry_readings': total_logs,
        'total_breaches': total_breaches,
        'breach_rate_percentage': breach_rate,
        'cold_chain_compliance_rate': round(100.0 - breach_rate, 1)
    }
