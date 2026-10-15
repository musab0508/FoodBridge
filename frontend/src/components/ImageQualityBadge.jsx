import React from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

export const ImageQualityBadge = ({ verified = true, score = 94.5 }) => {
  if (!verified) {
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
        <span>Image Pending Verification</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
      <span>OpenCV Verified Clean ({score}%)</span>
    </span>
  );
};
