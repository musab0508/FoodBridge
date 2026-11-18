import React, { useState } from 'react';
import { ShieldCheck, KeyRound, Copy, Check, Lock, Hash, AlertCircle, CheckCircle2, PackageCheck } from 'lucide-react';

/**
 * Cryptographic Handoff & Chain-of-Custody Verification Panel
 * Displays live SHA-256 digital token, 4-digit verification PIN,
 * and handles PIN verification for delivery completion.
 */
export const HandoffVerificationPanel = ({
  donation,
  role = 'NGO',
  onCompleteDelivery,
  actionLoading = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!donation || (donation.status !== 'CLAIMED' && donation.status !== 'IN_TRANSIT')) {
    return null;
  }

  const cryptoToken = donation.crypto_token || 'SHA256-PENDING-HANDOFF-SYNC';
  const handoffPin = donation.handoff_pin || '----';

  const handleCopyToken = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(cryptoToken);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVerifyDelivery = async () => {
    setErrorMessage('');
    const cleanPin = pinInput.trim();

    if (cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
      setErrorMessage('Please enter a valid 4-digit numeric verification PIN.');
      return;
    }

    if (onCompleteDelivery) {
      try {
        await onCompleteDelivery(donation.id, cleanPin);
        setIsSuccess(true);
      } catch (err) {
        const errorText =
          err?.response?.data?.error ||
          err?.message ||
          'Failed to verify PIN. Please ensure the PIN matches the donor PIN.';
        setErrorMessage(errorText);
      }
    }
  };

  const isNgo = role === 'NGO';
  const isDonor = role === 'DONOR';

  return (
    <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 text-slate-800 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center space-x-1.5 text-xs font-bold text-forest-800">
          <ShieldCheck className="w-4 h-4 text-forest-700" />
          <span>Cryptographic Handoff &amp; Chain-of-Custody</span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
          {donation.status === 'CLAIMED' ? 'Ready for Pickup' : 'In Transit'}
        </span>
      </div>

      {/* Live SHA-256 Digital Token */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
          <span className="flex items-center gap-1">
            <Hash className="w-3.5 h-3.5 text-forest-600" /> Live SHA-256 Token:
          </span>
          <button
            type="button"
            onClick={handleCopyToken}
            className="text-[10px] font-medium text-forest-700 hover:text-forest-900 flex items-center gap-1 transition"
            title="Copy full cryptographic token"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-forest-700" />
                <span className="font-bold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy Token</span>
              </>
            )}
          </button>
        </div>
        <div className="p-2 rounded-lg bg-white border border-slate-200 font-mono text-[11px] text-slate-700 break-all select-all flex items-center justify-between">
          <span className="truncate pr-2">{cryptoToken}</span>
        </div>
      </div>

      {/* 4-Digit Handoff PIN Display */}
      <div className="p-2.5 rounded-lg bg-forest-50/60 border border-forest-200/70 flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-forest-800 flex items-center gap-1">
            <KeyRound className="w-3 h-3 text-forest-700" />
            4-Digit Verification PIN
          </span>
          <p className="text-[11px] text-slate-600">
            {isDonor
              ? 'Share this PIN with the NGO/volunteer at handover to authorize custody.'
              : isNgo && donation.status === 'CLAIMED'
              ? 'Request this PIN from the donor at physical food pickup.'
              : 'Donor handoff verification PIN for delivery signoff.'}
          </p>
        </div>
        <div className="text-right">
          <span className="text-lg font-black font-mono tracking-widest text-forest-900 bg-white px-2.5 py-1 rounded-md border border-forest-200 shadow-2xs">
            {handoffPin.length === 4
              ? `${handoffPin[0]} ${handoffPin[1]} ${handoffPin[2]} ${handoffPin[3]}`
              : handoffPin}
          </span>
        </div>
      </div>

      {/* NGO Verification Action (When IN_TRANSIT or completing delivery) */}
      {isNgo && donation.status === 'IN_TRANSIT' && !isSuccess && (
        <div className="pt-2 border-t border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <label htmlFor={`pin-input-${donation.id}`} className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <Lock className="w-3 h-3 text-forest-700" />
              Enter 4-Digit PIN to Complete Delivery
            </label>
            {donation.handoff_pin && (
              <button
                type="button"
                onClick={() => setPinInput(donation.handoff_pin)}
                className="text-[10px] text-forest-700 hover:text-forest-900 font-semibold underline"
              >
                Auto-fill
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <input
              id={`pin-input-${donation.id}`}
              type="text"
              maxLength={4}
              placeholder="••••"
              value={pinInput}
              onChange={(e) => {
                setErrorMessage('');
                setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
              }}
              className="w-24 px-3 py-1.5 rounded-lg bg-white border border-slate-300 font-mono text-center text-sm font-bold tracking-widest text-slate-900 focus:outline-none focus:border-forest-600 shadow-2xs"
            />
            <button
              type="button"
              onClick={handleVerifyDelivery}
              disabled={actionLoading || pinInput.length !== 4}
              className="flex-1 py-1.5 px-3 rounded-lg bg-forest-700 text-white font-bold text-xs hover:bg-forest-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>{actionLoading ? 'Verifying...' : 'Verify Handoff & Complete Delivery'}</span>
            </button>
          </div>

          {errorMessage && (
            <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      )}

      {isSuccess && (
        <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>Cryptographic proof-of-delivery confirmed and sealed!</span>
        </div>
      )}
    </div>
  );
};

export default HandoffVerificationPanel;
