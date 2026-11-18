"""
FoodBridge Cryptographic Handoff & Non-Repudiable Verification Engine.

Generates and verifies cryptographically signed digital tokens and QR/PIN-based verification
workflows between Donors, Logistics Volunteers, and Receiving NGOs for non-repudiable delivery tracking.
"""

import hmac
import hashlib
import json
import base64
import secrets
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Tuple, Optional
from django.conf import settings

try:
    from django.conf import settings
    if settings.configured:
        DEFAULT_HANDOFF_SECRET = getattr(settings, 'HANDOFF_HMAC_SECRET', None) or getattr(settings, 'SECRET_KEY', 'FOODBRIDGE_SECRET_HMAC_KEY_2026')
    else:
        DEFAULT_HANDOFF_SECRET = 'FOODBRIDGE_SECRET_HMAC_KEY_2026'
except Exception:
    DEFAULT_HANDOFF_SECRET = 'FOODBRIDGE_SECRET_HMAC_KEY_2026'

TOKEN_EXPIRATION_MINUTES = 15


def get_secret_key_bytes(custom_key: Optional[str] = None) -> bytes:
    if custom_key:
        return custom_key.encode('utf-8')
    try:
        from django.conf import settings
        if settings.configured:
            secret = getattr(settings, 'HANDOFF_HMAC_SECRET', None) or getattr(settings, 'SECRET_KEY', DEFAULT_HANDOFF_SECRET)
            return str(secret).encode('utf-8')
    except Exception:
        pass
    return DEFAULT_HANDOFF_SECRET.encode('utf-8')


def derive_pin_from_hmac(hmac_bytes: bytes) -> str:
    """
    Derives a deterministic 6-digit numeric verification PIN from HMAC-SHA256 digest bytes
    following RFC 4226 dynamic truncation.
    """
    offset = hmac_bytes[-1] & 0x0f
    code = ((hmac_bytes[offset] & 0x7f) << 24 |
            (hmac_bytes[offset + 1] & 0xff) << 16 |
            (hmac_bytes[offset + 2] & 0xff) << 8 |
            (hmac_bytes[offset + 3] & 0xff)) % 1000000
    return f"{code:06d}"


def generate_handoff_token(
    donation_id: Any,
    volunteer_id: Any,
    target_id: Any,
    action: str,
    actor_role: str = 'VOLUNTEER',
    secret_key: Optional[str] = None,
    coordinates: Optional[Dict[str, float]] = None,
    validity_minutes: int = TOKEN_EXPIRATION_MINUTES
) -> Dict[str, Any]:
    """
    Generates a cryptographically signed digital token, QR payload, and 6-digit PIN.
    """
    action = action.upper()
    now_utc = datetime.now(timezone.utc)
    timestamp = now_utc.isoformat()
    expires_at = (now_utc + timedelta(minutes=validity_minutes)).isoformat()
    nonce = secrets.token_hex(8)

    # Canonical string: donationId:volunteerId:targetId:action:timestamp:nonce
    canonical = f"{donation_id}:{volunteer_id}:{target_id}:{action}:{timestamp}:{nonce}"
    key_bytes = get_secret_key_bytes(secret_key)
    h_bytes = hmac.new(key_bytes, canonical.encode('utf-8'), hashlib.sha256).digest()
    sig_hex = h_bytes.hex()
    pin = derive_pin_from_hmac(h_bytes)

    payload = {
        "donationId": str(donation_id),
        "volunteerId": str(volunteer_id),
        "targetId": str(target_id),
        "action": action,
        "actorRole": actor_role,
        "timestamp": timestamp,
        "nonce": nonce,
        "expiresAt": expires_at,
        "verificationPin": pin
    }
    if coordinates:
        payload["coordinates"] = {
            "latitude": float(coordinates.get("latitude", 0.0)),
            "longitude": float(coordinates.get("longitude", 0.0))
        }

    qr_dict = {
        "p": payload,
        "sig": sig_hex,
        "pin": pin
    }
    qr_payload_str = json.dumps(qr_dict, separators=(',', ':'))
    token_b64 = base64.urlsafe_b64encode(qr_payload_str.encode('utf-8')).decode('utf-8').rstrip('=')

    return {
        "token": token_b64,
        "qr_payload": qr_payload_str,
        "signature": sig_hex,
        "verification_pin": pin,
        "expires_at": expires_at,
        "payload": payload
    }


def verify_handoff_token(
    token_or_qr: str,
    secret_key: Optional[str] = None,
    expected_donation_id: Optional[Any] = None,
    expected_action: Optional[str] = None
) -> Tuple[bool, str, Optional[Dict[str, Any]], Optional[str]]:
    """
    Verifies a digital token or QR code string.
    Returns (is_valid, message, payload, signature).
    """
    token_or_qr = token_or_qr.strip()
    clean_json = token_or_qr

    # Handle Base64Url token
    if not clean_json.startswith('{'):
        try:
            # Add padding
            padding = 4 - (len(clean_json) % 4)
            if padding != 4:
                clean_json += '=' * padding
            clean_json = base64.urlsafe_b64decode(clean_json.encode('utf-8')).decode('utf-8')
        except Exception:
            return False, "Malformed token encoding.", None, None

    try:
        data = json.loads(clean_json)
    except Exception:
        return False, "Unparseable QR token payload.", None, None

    payload = data.get('p')
    claimed_sig = data.get('sig') or data.get('hash')

    if not payload or not claimed_sig:
        return False, "Invalid token structure: missing payload or signature.", None, None

    # Check donation ID
    if expected_donation_id is not None:
        if str(payload.get('donationId')) != str(expected_donation_id):
            return False, f"Token donation ID ({payload.get('donationId')}) does not match target ({expected_donation_id}).", payload, claimed_sig

    # Check action
    if expected_action is not None:
        if payload.get('action') != expected_action.upper():
            return False, f"Token stage ({payload.get('action')}) does not match expected ({expected_action}).", payload, claimed_sig

    # Recompute HMAC-SHA256
    canonical = f"{payload.get('donationId')}:{payload.get('volunteerId')}:{payload.get('targetId')}:{payload.get('action')}:{payload.get('timestamp')}:{payload.get('nonce')}"
    key_bytes = get_secret_key_bytes(secret_key)
    expected_sig = hmac.new(key_bytes, canonical.encode('utf-8'), hashlib.sha256).hexdigest().lower()

    if not hmac.compare_digest(claimed_sig.lower(), expected_sig):
        return False, "Cryptographic signature verification failed! Token has been tampered with.", payload, claimed_sig

    # Check expiration
    ts_str = payload.get('timestamp')
    if ts_str:
        try:
            ts_dt = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
            now_dt = datetime.now(timezone.utc)
            elapsed_mins = (now_dt - ts_dt).total_seconds() / 60.0
            if elapsed_mins > TOKEN_EXPIRATION_MINUTES:
                return False, f"Token has expired ({round(elapsed_mins, 1)} minutes elapsed).", payload, claimed_sig
            if elapsed_mins < -5.0:
                return False, "Token timestamp is in the future. Clock synchronization issue.", payload, claimed_sig
        except Exception:
            return False, "Invalid timestamp format in token payload.", payload, claimed_sig

    return True, "Tamper-proof cryptographic signature verified.", payload, claimed_sig


def verify_handoff_pin(
    pin: str,
    active_token_payload: Dict[str, Any],
    secret_key: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Verifies a 6-digit numeric verification PIN code against the active handoff session.
    """
    clean_pin = pin.strip().replace(" ", "")
    if not clean_pin.isdigit() or len(clean_pin) != 6:
        return False, "PIN must be a 6-digit numeric code."

    stored_pin = active_token_payload.get('verificationPin')
    if stored_pin and stored_pin == clean_pin:
        # Check expiration
        ts_str = active_token_payload.get('timestamp')
        if ts_str:
            try:
                ts_dt = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
                elapsed_mins = (datetime.now(timezone.utc) - ts_dt).total_seconds() / 60.0
                if elapsed_mins > TOKEN_EXPIRATION_MINUTES:
                    return False, "Verification PIN has expired."
            except Exception:
                pass
        return True, "Verification PIN confirmed."

    return False, "Invalid verification PIN."


def create_non_repudiation_audit_entry(
    donation,
    action: str,
    verified_by_user,
    signature: str,
    method: str = 'QR_SIGNATURE',
    coordinates: Optional[Dict[str, float]] = None,
    notes: str = ''
) -> Dict[str, Any]:
    """
    Creates an immutable non-repudiation audit hash and structured audit proof.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    coords_dict = coordinates if isinstance(coordinates, dict) else None
    coords_str = f"({coords_dict.get('latitude')}, {coords_dict.get('longitude')})" if coords_dict else "N/A"
    
    proof_raw = f"{donation.id}:{action}:{verified_by_user.id}:{signature}:{now_iso}"
    cert_hash = hashlib.sha256(proof_raw.encode('utf-8')).hexdigest()
    cert_id = f"CERT-{cert_hash[:12].upper()}"

    proof_data = {
        "certificate_id": cert_id,
        "certificate_hash": cert_hash,
        "sha256_checksum": cert_hash,
        "donation_id": donation.id,
        "action": action,
        "verified_by_id": verified_by_user.id,
        "verified_by_username": verified_by_user.username,
        "verified_by": {
            "id": verified_by_user.id,
            "username": verified_by_user.username,
        },
        "verified_at": now_iso,
        "method": method,
        "verification_method": method,
        "signature": signature,
        "coordinates": coords_dict if coords_dict is not None else coords_str,
        "coordinates_str": coords_str,
        "status": "NON_REPUDIABLE_VERIFIED"
    }

    return proof_data
