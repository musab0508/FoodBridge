'use client';

import React, { useState, useEffect } from 'react';
import { 
  generateHandoffToken, 
  verifyHandoffToken, 
  verifyHandoffPin, 
  HandoffTokenPayload,
  HandoffTokenResult 
} from '@/lib/cryptoHandoff';
import { 
  QrCode, 
  ShieldCheck, 
  CheckCircle2, 
  Lock, 
  X, 
  RefreshCw, 
  Copy, 
  Check, 
  KeyRound, 
  Clock, 
  ScanLine, 
  AlertCircle 
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface QRHandoffModalProps {
  isOpen: boolean;
  onClose: () => void;
  donationId: string;
  volunteerId: string;
  targetId: string;
  action: 'PICKUP' | 'DELIVERY';
  onHandoffComplete: (action: 'PICKUP' | 'DELIVERY', tokenHash: string) => void;
}

export const QRHandoffModal: React.FC<QRHandoffModalProps> = ({
  isOpen,
  onClose,
  donationId,
  volunteerId,
  targetId,
  action,
  onHandoffComplete
}) => {
  const [activeTab, setActiveTab] = useState<'display' | 'verify'>('display');
  const [tokenInfo, setTokenInfo] = useState<HandoffTokenResult>(() => 
    generateHandoffToken(donationId, volunteerId, targetId, action)
  );
  const [enteredPin, setEnteredPin] = useState('');
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [auditCertId, setAuditCertId] = useState<string | null>(null);

  // Re-generate token when opening modal or changing action/donation
  useEffect(() => {
    if (isOpen) {
      const newToken = generateHandoffToken(donationId, volunteerId, targetId, action);
      setTokenInfo(newToken);
      setIsVerified(false);
      setStatusMessage(null);
      setAuditCertId(null);
      setEnteredPin('');
      setActiveTab('display');
    }
  }, [isOpen, donationId, volunteerId, targetId, action]);

  if (!isOpen) return null;

  const handleCopyPin = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(tokenInfo.verificationPin);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerate = () => {
    const freshToken = generateHandoffToken(donationId, volunteerId, targetId, action);
    setTokenInfo(freshToken);
    setIsVerified(false);
    setStatusMessage({ text: 'Generated fresh cryptographic token and 6-digit PIN.', isError: false });
    setAuditCertId(null);
    setEnteredPin('');
  };

  const handleSimulateScan = () => {
    const verification = verifyHandoffToken(tokenInfo.qrPayload);
    if (verification.isValid) {
      setIsVerified(true);
      const certId = verification.auditCertificate?.certificateId || `CERT-${tokenInfo.hash.slice(0, 8).toUpperCase()}`;
      setAuditCertId(certId);
      setStatusMessage({ 
        text: `✅ ${verification.message} [Cert: ${certId}]`, 
        isError: false 
      });
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
      setTimeout(() => {
        onHandoffComplete(action, tokenInfo.hash);
        onClose();
      }, 1900);
    } else {
      setStatusMessage({ text: verification.message, isError: true });
    }
  };

  const handleVerifyPin = () => {
    const cleanPin = enteredPin.replace(/\s+/g, '').trim();
    if (cleanPin.length !== 6 || !/^\d{6}$/.test(cleanPin)) {
      setStatusMessage({ text: 'Please enter a valid 6-digit numeric PIN.', isError: true });
      return;
    }

    const verification = verifyHandoffPin(cleanPin, tokenInfo.payload);
    if (verification.isValid) {
      setIsVerified(true);
      const certId = verification.auditCertificate?.certificateId || `FB-PIN-${cleanPin}`;
      setAuditCertId(certId);
      setStatusMessage({ 
        text: `✅ Non-repudiable Proof-of-${action} verified! [Cert: ${certId}]`, 
        isError: false 
      });
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
      setTimeout(() => {
        onHandoffComplete(action, tokenInfo.hash);
        onClose();
      }, 1900);
    } else {
      setStatusMessage({ text: verification.message || 'Invalid verification PIN code.', isError: true });
    }
  };

  const formattedPin = tokenInfo.verificationPin.length === 6 
    ? `${tokenInfo.verificationPin.slice(0, 3)} ${tokenInfo.verificationPin.slice(3)}`
    : tokenInfo.verificationPin;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-white text-center overflow-hidden">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition"
          aria-label="Close Modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 mb-3 shadow-inner">
          <QrCode className="w-8 h-8 animate-pulse" />
        </div>

        <h2 className="text-xl font-extrabold text-slate-100 tracking-tight">
          Cryptographic Proof-of-Handoff
        </h2>
        <p className="text-xs text-slate-400 mb-4 font-medium">
          Dual-token HMAC-SHA256 signature &amp; 6-digit PIN verification for <b className="text-emerald-400 uppercase">{action}</b>
        </p>

        {/* Mode Toggle Tabs */}
        <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('display')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'display' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/30' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ScanLine className="w-3.5 h-3.5" /> Present QR &amp; PIN
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('verify')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'verify' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/30' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" /> Enter 6-Digit PIN
          </button>
        </div>

        {/* Tab 1: Present QR Code & 6-Digit PIN */}
        {activeTab === 'display' && (
          <div className="space-y-4">
            {/* Visual QR Pattern Container */}
            <div className="bg-white p-4 rounded-2xl inline-block shadow-2xl border-4 border-emerald-500/40 relative">
              <svg className="w-40 h-40 mx-auto text-slate-950" viewBox="0 0 100 100">
                {/* SVG simulated QR matrix pattern */}
                <rect x="5" y="5" width="25" height="25" fill="#0f172a" rx="2" />
                <rect x="9" y="9" width="17" height="17" fill="#ffffff" rx="1" />
                <rect x="13" y="13" width="9" height="9" fill="#0f172a" rx="1" />
                
                <rect x="70" y="5" width="25" height="25" fill="#0f172a" rx="2" />
                <rect x="74" y="9" width="17" height="17" fill="#ffffff" rx="1" />
                <rect x="78" y="13" width="9" height="9" fill="#0f172a" rx="1" />

                <rect x="5" y="70" width="25" height="25" fill="#0f172a" rx="2" />
                <rect x="9" y="74" width="17" height="17" fill="#ffffff" rx="1" />
                <rect x="13" y="78" width="9" height="9" fill="#0f172a" rx="1" />

                {/* Internal matrix dots */}
                <circle cx="45" cy="15" r="3" fill="#0f172a" />
                <circle cx="55" cy="25" r="3" fill="#0f172a" />
                <circle cx="35" cy="45" r="4" fill="#0f172a" />
                <circle cx="50" cy="50" r="5" fill="#10b981" />
                <circle cx="65" cy="45" r="4" fill="#0f172a" />
                <circle cx="45" cy="75" r="3" fill="#0f172a" />
                <circle cx="75" cy="75" r="4" fill="#0f172a" />
                <circle cx="85" cy="50" r="3" fill="#0f172a" />
                <circle cx="15" cy="50" r="3" fill="#0f172a" />
              </svg>

              <div className="mt-2 text-[10px] font-mono text-slate-600 truncate max-w-[200px] mx-auto bg-slate-100 py-0.5 px-1.5 rounded">
                HMAC: {tokenInfo.hash.slice(0, 16)}...
              </div>
            </div>

            {/* 6-Digit PIN Highlight Box */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-emerald-500/30 flex items-center justify-between">
              <div className="text-left">
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider block flex items-center gap-1">
                  <KeyRound className="w-3 h-3" /> RFC 4226 6-Digit Verification PIN
                </span>
                <span className="text-2xl font-black font-mono tracking-widest text-white">
                  {formattedPin}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyPin}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Security Payload Details */}
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs text-left font-mono space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-emerald-400" /> Dual-Party Non-Repudiation</span>
                <span className="text-[10px] text-amber-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Expires in 15m
                </span>
              </div>
              <div className="text-slate-300 truncate text-[11px]">Donation: <span className="text-emerald-400 font-semibold">{donationId}</span></div>
              <div className="text-slate-300 truncate text-[11px]">Volunteer: <span className="text-slate-100">{volunteerId}</span></div>
            </div>

            {/* Action Buttons for Display Mode */}
            <div className="flex space-x-2 pt-1">
              <button
                type="button"
                onClick={handleRegenerate}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>

              <button
                type="button"
                onClick={handleSimulateScan}
                disabled={isVerified}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 font-bold text-sm text-white shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                {isVerified ? 'Verified & Non-Repudiable' : `Simulate QR Scan (${action})`}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Manual 6-Digit PIN Entry */}
        {activeTab === 'verify' && (
          <div className="space-y-4 text-left">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <label htmlFor="handoff-pin-input" className="text-xs font-bold text-slate-300 block flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                Enter 6-Digit Handoff PIN
              </label>
              <p className="text-[11px] text-slate-400">
                Ask the releasing party ({action === 'PICKUP' ? 'Donor' : 'Volunteer'}) for their 6-digit confirmation code.
              </p>

              <div className="flex gap-2">
                <input
                  id="handoff-pin-input"
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="flex-1 bg-slate-900 border border-slate-700 text-white font-mono text-center text-2xl font-bold tracking-widest rounded-xl py-2 px-3 focus:outline-none focus:border-emerald-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setEnteredPin(tokenInfo.verificationPin)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold whitespace-nowrap transition"
                  title="Autofill current PIN for testing"
                >
                  Paste Active
                </button>
              </div>

              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                <Lock className="w-3 h-3 text-slate-400" />
                Verifies against HMAC-SHA256 signature dynamically.
              </div>
            </div>

            <button
              type="button"
              onClick={handleVerifyPin}
              disabled={isVerified || enteredPin.length !== 6}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 font-bold text-sm text-white shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              {isVerified ? 'PIN Verified & Custody Sealed' : `Verify PIN & Confirm ${action}`}
            </button>
          </div>
        )}

        {/* Status / Audit Feedback Display */}
        {statusMessage && (
          <div className={`mt-4 p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
            statusMessage.isError 
              ? 'bg-red-500/20 text-red-400 border border-red-500/40' 
              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
          }`}>
            {statusMessage.isError ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Certificate Stamp */}
        {auditCertId && (
          <div className="mt-2 text-[10px] font-mono text-slate-400">
            Immutable Audit Certificate: <span className="text-emerald-400 font-bold">{auditCertId}</span>
          </div>
        )}

      </div>
    </div>
  );
};
