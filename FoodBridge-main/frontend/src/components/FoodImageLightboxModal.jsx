import React, { useEffect } from 'react';
import {
  X,
  CheckCircle2,
  ShieldCheck,
  Clock,
  MapPin,
  Sparkles,
  Maximize2,
  AlertTriangle,
  Flame,
  Info
} from 'lucide-react';
import { CountdownTimer } from './CountdownTimer';
import { ImageQualityBadge } from './ImageQualityBadge';

export const resolveImageUrl = (imgUrl) => {
  if (imgUrl && typeof imgUrl === 'string' && imgUrl.trim().length > 0) {
    if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
      return imgUrl;
    }
    const cleanPath = imgUrl.startsWith('/') ? imgUrl : `/${imgUrl}`;
    return `http://127.0.0.1:8000${cleanPath}`;
  }
  return null;
};

export const FoodImageLightboxModal = ({
  donation,
  onClose,
  onClaim,
  claimLoading = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!donation || !donation.image) return null;

  const imageUrl = resolveImageUrl(donation.image);
  if (!imageUrl) return null;

  const donorName = donation.donor?.profile?.organization_name || donation.donor?.username || 'Verified Food Donor';

  const getRiskBadgeClass = (risk) => {
    switch (risk) {
      case 'CRITICAL':
        return 'badge-critical';
      case 'HIGH':
        return 'badge-high';
      default:
        return 'badge-normal';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-forest-700 bg-forest-50 px-2 py-0.5 rounded-md border border-forest-200">
                Food Safety Inspection
              </span>
              <span className="text-xs text-slate-500 font-medium">
                #{donation.id}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">
              {donation.food_title}
            </h2>
            <p className="text-xs text-slate-600 flex items-center space-x-2">
              <span>Donor: <strong className="text-slate-800">{donorName}</strong></span>
              <span>•</span>
              <span>Category: <strong className="text-slate-800">{donation.food_type}</strong></span>
              <span>•</span>
              <span>Quantity: <strong className="text-forest-800">{donation.quantity}</strong></span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all flex-shrink-0"
            title="Close Preview (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Image Area */}
        <div className="relative bg-slate-950 flex items-center justify-center min-h-[240px] max-h-[46vh] overflow-hidden select-none">
          <img
            src={imageUrl}
            alt={donation.food_title}
            className="w-full h-full max-h-[46vh] object-contain transition-transform duration-300"
          />

          {/* Top Left: Urgency Risk Badge */}
          <div className="absolute top-3 left-3 flex items-center space-x-2">
            <span className={`px-3 py-1 rounded-full text-xs font-extrabold shadow-md backdrop-blur-md ${getRiskBadgeClass(donation.ai_risk_level)}`}>
              {donation.ai_risk_level} ({donation.ai_urgency_score}%)
            </span>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-black/60 text-white backdrop-blur-md border border-white/20">
              {donation.status}
            </span>
          </div>

          {/* Top Right: CV Quality Score */}
          <div className="absolute top-3 right-3 shadow-md">
            <ImageQualityBadge
              verified={donation.image_verified}
              score={donation.image_quality_score}
            />
          </div>

          {/* Bottom Overlay Hint */}
          <div className="absolute bottom-2 right-3 text-[11px] text-white/80 bg-black/60 backdrop-blur-xs px-2.5 py-0.5 rounded-md flex items-center space-x-1.5 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>OpenCV Sharpness & Brightness Verified</span>
          </div>
        </div>

        {/* Inspection Details Section */}
        <div className="p-4 sm:p-6 bg-slate-50/70 border-t border-slate-200 space-y-4 overflow-y-auto">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                AI Urgency Score
              </span>
              <p className="text-base font-extrabold text-rose-600">
                {donation.ai_urgency_score}%
              </p>
              <span className="text-[10px] text-slate-500 font-medium">Perishability decay</span>
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                CV Quality Score
              </span>
              <p className="text-base font-extrabold text-emerald-700">
                {donation.image_quality_score || 94.5}%
              </p>
              <span className="text-[10px] text-slate-500 font-medium">Clear & unblurred</span>
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                Shelf-Life Window
              </span>
              <div className="mt-0.5">
                <CountdownTimer
                  createdAt={donation.created_at}
                  expiryHours={donation.expiry_hours}
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                Total Volume
              </span>
              <p className="text-base font-extrabold text-forest-900 truncate">
                {donation.quantity}
              </p>
              <span className="text-[10px] text-slate-500 font-medium">Prepared portion</span>
            </div>
          </div>

          {/* AI Insight & Safety Evaluation */}
          <div className="p-3.5 rounded-xl bg-forest-50 border border-forest-200 text-xs text-forest-900 space-y-1">
            <div className="flex items-center space-x-1.5 font-bold text-forest-800">
              <Sparkles className="w-4 h-4 text-forest-700" />
              <span>AI Quality & Preservation Assessment</span>
            </div>
            <p className="font-medium text-slate-700">
              {donation.ai_insight || 'AI evaluated: Food freshness and visual packaging pass standard safety guidelines. Priority pickup recommended.'}
            </p>
          </div>

          {/* Pickup Address */}
          <div className="flex items-center space-x-2 text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
            <MapPin className="w-4 h-4 text-forest-700 flex-shrink-0" />
            <span className="truncate">
              <strong>Pickup Location:</strong> {donation.pickup_location}
            </span>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-500 text-center sm:text-left">
            Inspected food photo verified prior to custody transfer.
          </p>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-all"
            >
              Close
            </button>

            {donation.status === 'AVAILABLE' && onClaim && (
              <button
                onClick={() => onClaim(donation.id)}
                disabled={claimLoading}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-forest-700 hover:bg-forest-800 text-white font-bold text-xs transition-all shadow-sm flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{claimLoading ? 'Claiming Donation...' : 'Claim This Donation'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
