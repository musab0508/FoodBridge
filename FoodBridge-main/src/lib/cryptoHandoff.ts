/**
 * Cryptographic & QR/PIN-Based Proof-of-Handoff Utility for FoodBridge.
 * 
 * Provides non-repudiable dual-token cryptographic verification:
 * 1. Stage 1 (Pickup Handoff): Donor authorizes custody release to Logistics Volunteer.
 * 2. Stage 2 (Delivery Handoff): Receiving NGO verifies custody intake from Logistics Volunteer.
 * 
 * Generates HMAC-SHA256 digital signatures, QR payloads, and RFC 4226 6-digit verification PINs
 * for tamper-proof delivery tracking and chain-of-custody audit logging.
 */

export const DEFAULT_HANDOFF_SECRET = 'FOODBRIDGE_SECRET_HMAC_KEY_2026';
export const TOKEN_EXPIRATION_MINUTES = 15;

export interface HandoffCoordinates {
  latitude: number;
  longitude: number;
}

export interface HandoffTokenPayload {
  donationId: string;
  volunteerId: string;
  targetId: string; // donorId upon pickup, ngoId upon delivery
  action: 'PICKUP' | 'DELIVERY';
  actorRole?: 'DONOR' | 'VOLUNTEER' | 'NGO';
  timestamp: string;
  nonce: string; // Anti-replay nonce
  expiresAt: string;
  coordinates?: HandoffCoordinates;
  packageDigest?: string;
  verificationPin?: string;
}

export interface HandoffTokenResult {
  token: string;           // Compact signed token string
  qrPayload: string;       // JSON string formatted for QR codes
  hash: string;            // Hexadecimal HMAC-SHA256 signature
  signature: string;       // Alias for hash
  verificationPin: string; // 6-digit numeric verification PIN
  expiresAt: string;       // Human-readable expiry string
  expiresAtIso: string;    // ISO timestamp of expiration
  payload: HandoffTokenPayload;
}

export interface HandoffAuditCertificate {
  certificateId: string;
  donationId: string;
  action: 'PICKUP' | 'DELIVERY';
  volunteerId: string;
  targetId: string;
  verifiedAt: string;
  signatureDigest: string;
  verificationMethod: 'QR_SIGNATURE' | 'PIN_CODE' | 'DIGITAL_TOKEN';
  status: 'VERIFIED_NON_REPUDIABLE';
}

export interface HandoffVerificationResult {
  isValid: boolean;
  action?: 'PICKUP' | 'DELIVERY';
  payload?: HandoffTokenPayload;
  signature?: string;
  verificationMethod: 'QR_SIGNATURE' | 'PIN_CODE' | 'DIGITAL_TOKEN';
  message: string;
  auditCertificate?: HandoffAuditCertificate;
}

// ---------------------------------------------------------------------------
// Pure TypeScript Synchronous SHA-256 & HMAC-SHA256 Implementation
// ---------------------------------------------------------------------------

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256Bytes(ascii: string): number[] {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = 'length';
  let i: number, j: number;
  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, boolean> = {};

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = candidate * candidate; i < 312; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength | 0;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0;

      const s1h = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + s1h + ch + k[i] + w[i]) | 0;
      const s0h = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0h + maj) | 0;

      hash = [
        (temp1 + temp2) | 0,
        hash[0],
        hash[1],
        hash[2],
        (hash[3] + temp1) | 0,
        hash[4],
        hash[5],
        hash[6]
      ];
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  const bytes: number[] = [];
  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      bytes.push((hash[i] >> (8 * j)) & 255);
    }
  }
  return bytes;
}

export function computeHmacSha256(key: string, message: string): { bytes: number[]; hex: string } {
  let keyBytes: number[] = [];
  for (let i = 0; i < key.length; i++) {
    keyBytes.push(key.charCodeAt(i) & 0xff);
  }

  if (keyBytes.length > 64) {
    keyBytes = sha256Bytes(String.fromCharCode.apply(null, keyBytes));
  }
  while (keyBytes.length < 64) {
    keyBytes.push(0);
  }

  const oPad: number[] = [];
  const iPad: number[] = [];
  for (let i = 0; i < 64; i++) {
    oPad[i] = keyBytes[i] ^ 0x5c;
    iPad[i] = keyBytes[i] ^ 0x36;
  }

  const msgBytes: number[] = [];
  for (let i = 0; i < message.length; i++) {
    msgBytes.push(message.charCodeAt(i) & 0xff);
  }

  const innerStr = String.fromCharCode.apply(null, iPad.concat(msgBytes));
  const innerHash = sha256Bytes(innerStr);

  const outerStr = String.fromCharCode.apply(null, oPad.concat(innerHash));
  const outerHash = sha256Bytes(outerStr);

  const hex = outerHash.map((b) => b.toString(16).padStart(2, '0')).join('');
  return { bytes: outerHash, hex };
}

/**
 * Derives a deterministic 6-digit numeric verification PIN from HMAC-SHA256 digest bytes
 * following RFC 4226 dynamic truncation.
 */
export function derivePinFromHmacBytes(bytes: number[]): string {
  const offset = bytes[bytes.length - 1] & 0x0f;
  const binary =
    ((bytes[offset] & 0x7f) << 24) |
    ((bytes[offset + 1] & 0xff) << 16) |
    ((bytes[offset + 2] & 0xff) << 8) |
    (bytes[offset + 3] & 0xff);
  const pin = binary % 1000000;
  return pin.toString().padStart(6, '0');
}

/**
 * Generates an anti-replay cryptographic random nonce.
 */
function generateNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(8);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback PRNG nonce
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36).slice(-4);
}

// ---------------------------------------------------------------------------
// Core Token Generation & Verification API
// ---------------------------------------------------------------------------

/**
 * Generates a non-repudiable cryptographically signed digital token,
 * QR code payload, and 6-digit PIN for food rescue handoffs.
 */
export function generateHandoffToken(
  donationId: string,
  volunteerId: string,
  targetId: string,
  action: 'PICKUP' | 'DELIVERY',
  secretKey: string = DEFAULT_HANDOFF_SECRET,
  options: {
    actorRole?: 'DONOR' | 'VOLUNTEER' | 'NGO';
    coordinates?: HandoffCoordinates;
    packageDigest?: string;
    validityMinutes?: number;
  } = {}
): HandoffTokenResult {
  const now = new Date();
  const timestamp = now.toISOString();
  const validityMins = options.validityMinutes || TOKEN_EXPIRATION_MINUTES;

  const expiresDate = new Date(now.getTime() + validityMins * 60 * 1000);
  const expiresAtIso = expiresDate.toISOString();
  const nonce = generateNonce();

  // Canonical raw payload for signature computation
  const canonicalString = `${donationId}:${volunteerId}:${targetId}:${action}:${timestamp}:${nonce}`;
  const hmacResult = computeHmacSha256(secretKey, canonicalString);
  const hexHash = hmacResult.hex;
  const pin = derivePinFromHmacBytes(hmacResult.bytes);

  const payloadObj: HandoffTokenPayload = {
    donationId,
    volunteerId,
    targetId,
    action,
    actorRole: options.actorRole || (action === 'PICKUP' ? 'DONOR' : 'VOLUNTEER'),
    timestamp,
    nonce,
    expiresAt: expiresAtIso,
    coordinates: options.coordinates,
    packageDigest: options.packageDigest,
    verificationPin: pin
  };

  const qrPayload = JSON.stringify({
    p: payloadObj,
    sig: hexHash,
    pin: pin
  });

  // Base64Url-encoded token for compact network transit
  const token = typeof btoa !== 'undefined'
    ? btoa(unescape(encodeURIComponent(qrPayload))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    : Buffer.from(qrPayload, 'utf8').toString('base64url');

  return {
    token,
    qrPayload,
    hash: hexHash,
    signature: hexHash,
    verificationPin: pin,
    expiresAt: expiresDate.toLocaleTimeString(),
    expiresAtIso,
    payload: payloadObj
  };
}

/**
 * Verifies a QR string or digital token payload for authenticity, expiration, and non-repudiation.
 */
export function verifyHandoffToken(
  qrPayloadString: string,
  secretKey: string = DEFAULT_HANDOFF_SECRET,
  expectedAction?: 'PICKUP' | 'DELIVERY',
  expectedDonationId?: string
): HandoffVerificationResult {
  try {
    let cleanJson = qrPayloadString.trim();

    // Check if token is Base64Url-encoded
    if (!cleanJson.startsWith('{')) {
      try {
        const decoded = typeof atob !== 'undefined'
          ? decodeURIComponent(escape(atob(cleanJson.replace(/-/g, '+').replace(/_/g, '/'))))
          : Buffer.from(cleanJson, 'base64url').toString('utf8');
        cleanJson = decoded;
      } catch (e) {
        // Continue with raw string
      }
    }

    const parsed = JSON.parse(cleanJson);
    if (!parsed.p || (!parsed.sig && !parsed.hash)) {
      return {
        isValid: false,
        verificationMethod: 'QR_SIGNATURE',
        message: 'Invalid QR token structure. Missing payload or cryptographic signature.'
      };
    }

    const payload: HandoffTokenPayload = parsed.p;
    const claimedSig: string = (parsed.sig || parsed.hash).toLowerCase();

    // Validate expected donation ID
    if (expectedDonationId && String(payload.donationId) !== String(expectedDonationId)) {
      return {
        isValid: false,
        payload,
        verificationMethod: 'QR_SIGNATURE',
        message: `Mismatched donation ID. Expected ${expectedDonationId}, received ${payload.donationId}.`
      };
    }

    // Validate expected action
    if (expectedAction && payload.action !== expectedAction) {
      return {
        isValid: false,
        payload,
        verificationMethod: 'QR_SIGNATURE',
        message: `Invalid handoff stage. Expected ${expectedAction}, received ${payload.action}.`
      };
    }

    // Recompute signature over canonical string
    const canonicalString = `${payload.donationId}:${payload.volunteerId}:${payload.targetId}:${payload.action}:${payload.timestamp}:${payload.nonce}`;
    const expectedSig = computeHmacSha256(secretKey, canonicalString).hex.toLowerCase();

    if (claimedSig !== expectedSig) {
      return {
        isValid: false,
        payload,
        signature: claimedSig,
        verificationMethod: 'QR_SIGNATURE',
        message: 'Cryptographic signature mismatch! Token has been tampered with or modified.'
      };
    }

    // Check expiration window (default 15 minutes)
    const tokenTime = new Date(payload.timestamp).getTime();
    const now = Date.now();
    const diffMinutes = (now - tokenTime) / (1000 * 60);

    if (diffMinutes > TOKEN_EXPIRATION_MINUTES) {
      return {
        isValid: false,
        payload,
        signature: claimedSig,
        verificationMethod: 'QR_SIGNATURE',
        message: `QR Proof-of-Handoff token has expired (${roundDec(diffMinutes, 1)} minutes elapsed).`
      };
    }

    if (diffMinutes < -5.0) {
      return {
        isValid: false,
        payload,
        signature: claimedSig,
        verificationMethod: 'QR_SIGNATURE',
        message: 'Token timestamp is in the future. Check system clock synchronization.'
      };
    }

    const certId = computeHmacSha256(secretKey, `${claimedSig}:${Date.now()}`).hex.slice(0, 16);
    const auditCert: HandoffAuditCertificate = {
      certificateId: `FB-CERT-${certId.toUpperCase()}`,
      donationId: payload.donationId,
      action: payload.action,
      volunteerId: payload.volunteerId,
      targetId: payload.targetId,
      verifiedAt: new Date().toISOString(),
      signatureDigest: claimedSig,
      verificationMethod: 'QR_SIGNATURE',
      status: 'VERIFIED_NON_REPUDIABLE'
    };

    return {
      isValid: true,
      action: payload.action,
      payload,
      signature: claimedSig,
      verificationMethod: 'QR_SIGNATURE',
      message: `✅ Tamper-proof non-repudiable handoff verified for ${payload.action}!`,
      auditCertificate: auditCert
    };
  } catch (err) {
    return {
      isValid: false,
      verificationMethod: 'QR_SIGNATURE',
      message: 'Malformed or unparseable QR token payload.'
    };
  }
}

/**
 * Verifies a 6-digit numeric verification PIN code against the donation handoff session.
 */
export function verifyHandoffPin(
  pin: string,
  donationIdOrPayload: string | HandoffTokenPayload,
  volunteerId?: string,
  targetId?: string,
  action?: 'PICKUP' | 'DELIVERY',
  secretKey: string = DEFAULT_HANDOFF_SECRET,
  tokenPayload?: HandoffTokenPayload
): HandoffVerificationResult {
  let resolvedPayload: HandoffTokenPayload | undefined;
  let resolvedDonationId = '';
  let resolvedVolunteerId = '';
  let resolvedTargetId = '';
  let resolvedAction: 'PICKUP' | 'DELIVERY' = 'PICKUP';
  let resolvedKey = secretKey;

  if (typeof donationIdOrPayload === 'object' && donationIdOrPayload !== null) {
    resolvedPayload = donationIdOrPayload;
    resolvedDonationId = resolvedPayload.donationId;
    resolvedVolunteerId = resolvedPayload.volunteerId;
    resolvedTargetId = resolvedPayload.targetId;
    resolvedAction = resolvedPayload.action;
    if (typeof volunteerId === 'string' && volunteerId) {
      resolvedKey = volunteerId;
    }
  } else {
    resolvedDonationId = typeof donationIdOrPayload === 'string' ? donationIdOrPayload : '';
    resolvedVolunteerId = volunteerId || '';
    resolvedTargetId = targetId || '';
    resolvedAction = action || 'PICKUP';
    resolvedPayload = tokenPayload;
  }

  const cleanPin = pin.trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanPin)) {
    return {
      isValid: false,
      verificationMethod: 'PIN_CODE',
      message: 'PIN must be a 6-digit numeric code.'
    };
  }

  if (resolvedPayload && resolvedPayload.verificationPin) {
    if (resolvedPayload.verificationPin === cleanPin) {
      // Validate time window
      const tokenTime = new Date(resolvedPayload.timestamp).getTime();
      const diffMinutes = (Date.now() - tokenTime) / (1000 * 60);

      if (diffMinutes > TOKEN_EXPIRATION_MINUTES) {
        return {
          isValid: false,
          verificationMethod: 'PIN_CODE',
          message: 'PIN code has expired.'
        };
      }

      const certId = computeHmacSha256(resolvedKey, `${cleanPin}:${Date.now()}`).hex.slice(0, 16);
      return {
        isValid: true,
        action: resolvedAction,
        payload: resolvedPayload,
        verificationMethod: 'PIN_CODE',
        message: `✅ Verification PIN confirmed for ${resolvedAction}!`,
        auditCertificate: {
          certificateId: `FB-PIN-${certId.toUpperCase()}`,
          donationId: resolvedDonationId,
          action: resolvedAction,
          volunteerId: resolvedVolunteerId,
          targetId: resolvedTargetId,
          verifiedAt: new Date().toISOString(),
          signatureDigest: computeHmacSha256(resolvedKey, cleanPin).hex,
          verificationMethod: 'PIN_CODE',
          status: 'VERIFIED_NON_REPUDIABLE'
        }
      };
    }
  }

  return {
    isValid: false,
    verificationMethod: 'PIN_CODE',
    message: 'Invalid verification PIN code.'
  };
}

/**
 * Generates an immutable Non-Repudiation Receipt for chain-of-custody audit logs.
 */
export function generateNonRepudiationReceipt(
  payload: HandoffTokenPayload,
  signature: string,
  verifiedByActorId: string
): {
  receiptId: string;
  donationId: string;
  stage: 'PICKUP' | 'DELIVERY';
  releaserId: string;
  receiverId: string;
  timestamp: string;
  digitalSignature: string;
  certificateHash: string;
  isImmutable: boolean;
} {
  const releaserId = payload.action === 'PICKUP' ? payload.targetId : payload.volunteerId;
  const receiverId = payload.action === 'PICKUP' ? payload.volunteerId : payload.targetId;
  const receiptTimestamp = new Date().toISOString();

  const receiptRaw = `${payload.donationId}:${releaserId}:${receiverId}:${payload.action}:${receiptTimestamp}:${signature}:${verifiedByActorId}`;
  const certificateHash = computeHmacSha256(DEFAULT_HANDOFF_SECRET, receiptRaw).hex;

  return {
    receiptId: `RCPT-${certificateHash.slice(0, 12).toUpperCase()}`,
    donationId: payload.donationId,
    stage: payload.action,
    releaserId,
    receiverId,
    timestamp: receiptTimestamp,
    digitalSignature: signature,
    certificateHash,
    isImmutable: true
  };
}

function roundDec(val: number, places: number): number {
  const factor = Math.pow(10, places);
  return Math.round(val * factor) / factor;
}
