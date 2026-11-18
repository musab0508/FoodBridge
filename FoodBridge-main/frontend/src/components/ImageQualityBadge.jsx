import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const ImageQualityBadge = ({ verified = false, score = 0 }) => {
  if (!verified || !score || score <= 0) {
    return null;
  }

  return (
    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
      <span>OpenCV Verified Clean ({score}%)</span>
    </span>
  );
};
