'use client';

import React, { useState } from 'react';
import { generateHandoffToken, verifyHandoffToken, HandoffTokenPayload } from '@/lib/cryptoHandoff';
import { QrCode, ShieldCheck, CheckCircle2, Lock, X, RefreshCw } from 'lucide-react';
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
  const [tokenInfo, setTokenInfo] = useState(() => 
    generateHandoffToken(donationId, volunteerId, targetId, action)
  );
  const [scannedStatus, setScannedStatus] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  if (!isOpen) return null;

  const handleSimulateScan = () => {
    const verification = verifyHandoffToken(tokenInfo.qrPayload);
    if (verification.isValid) {
      setIsVerified(true);
      setScannedStatus(verification.message);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => {
        onHandoffComplete(action, tokenInfo.hash);
        onClose();
      }, 1800);
    } else {
      setScannedStatus(verification.message);
    }
  };

  const handleRegenerate = () => {
    setTokenInfo(generateHandoffToken(donationId, volunteerId, targetId, action));
    setIsVerified(false);
    setScannedStatus(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-white text-center">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 mb-3">
          <QrCode className="w-8 h-8 animate-pulse" />
        </div>

        <h2 className="text-xl font-extrabold text-slate-100 mb-1">
          Cryptographic Proof-of-Handoff
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Dual-token HMAC signature verification for <b className="text-emerald-400">{action}</b>
        </p>

        {/* QR Code Visual Box */}
        <div className="bg-white p-4 rounded-2xl inline-block shadow-xl border-4 border-emerald-500/40 mb-4 relative">
          <svg className="w-44 h-44 mx-auto text-slate-950" viewBox="0 0 100 100">
            {/* SVG simulated QR matrix pattern */}
            <rect x="5" y="5" width="25" height="25" fill="#0f172a" />
            <rect x="9" y="9" width="17" height="17" fill="#ffffff" />
            <rect x="13" y="13" width="9" height="9" fill="#0f172a" />
            
            <rect x="70" y="5" width="25" height="25" fill="#0f172a" />
            <rect x="74" y="9" width="17" height="17" fill="#ffffff" />
            <rect x="78" y="13" width="9" height="9" fill="#0f172a" />

            <rect x="5" y="70" width="25" height="25" fill="#0f172a" />
            <rect x="9" y="74" width="17" height="17" fill="#ffffff" />
            <rect x="13" y="78" width="9" height="9" fill="#0f172a" />

            {/* Matrix dots */}
            <circle cx="45" cy="15" r="3" fill="#0f172a" />
            <circle cx="55" cy="25" r="3" fill="#0f172a" />
            <circle cx="35" cy="45" r="4" fill="#0f172a" />
            <circle cx="50" cy="50" r="5" fill="#10b981" />
            <circle cx="65" cy="45" r="4" fill="#0f172a" />
            <circle cx="45" cy="75" r="3" fill="#0f172a" />
            <circle cx="75" cy="75" r="4" fill="#0f172a" />
          </svg>
          <div className="mt-2 text-[10px] font-mono text-slate-600 truncate max-w-[180px] mx-auto">
            SIG: {tokenInfo.hash}
          </div>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs mb-4 text-left font-mono">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-emerald-400" /> HMAC-SHA256 Payload</span>
            <span className="text-[10px] text-amber-400">Expires {tokenInfo.expiresAt}</span>
          </div>
          <div className="text-slate-300 truncate">Donation: {donationId}</div>
          <div className="text-slate-300 truncate">Volunteer: {volunteerId}</div>
        </div>

        {scannedStatus && (
          <div className={`p-3 rounded-xl mb-4 text-xs font-bold flex items-center justify-center gap-2 ${
            isVerified ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400'
          }`}>
            <CheckCircle2 className="w-4 h-4" /> {scannedStatus}
          </div>
        )}

        <div className="flex space-x-2">
          <button
            onClick={handleRegenerate}
            className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>

          <button
            onClick={handleSimulateScan}
            disabled={isVerified}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 font-bold text-sm text-white shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            {isVerified ? 'Verified & Sealed' : `Scan & Verify ${action}`}
          </button>
        </div>

      </div>
    </div>
  );
};
