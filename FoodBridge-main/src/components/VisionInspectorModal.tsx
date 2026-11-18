'use client';

import React from 'react';
import { Eye, ShieldCheck, AlertTriangle, PackageCheck, Layers, Sparkles, X } from 'lucide-react';

interface VisionInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  inspectionData: any;
  foodTitle: string;
}

export const VisionInspectorModal: React.FC<VisionInspectorModalProps> = ({
  isOpen,
  onClose,
  inspectionData,
  foodTitle
}) => {
  if (!isOpen || !inspectionData) return null;

  const isApproved = inspectionData.safetyApproval;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative overflow-hidden text-white">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-5">
          <div className="p-3 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-400 text-slate-950 shadow-lg shadow-emerald-500/20">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> AI Vision Quality & Spoilage Inspector
            </span>
            <h2 className="text-lg font-bold text-slate-100">{foodTitle}</h2>
          </div>
        </div>

        {/* Quality Score Hero Gauge */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 mb-5 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block mb-1">Quality & Safety Index</span>
            <div className="flex items-baseline space-x-2">
              <span className={`text-4xl font-extrabold ${isApproved ? 'text-emerald-400' : 'text-red-400'}`}>
                {inspectionData.qualityIndex}%
              </span>
              <span className="text-xs font-semibold text-slate-400">/ 100.0 Standard</span>
            </div>
            <span className="text-xs text-slate-400 mt-1 block">
              Freshness Status: <b className="text-white">{inspectionData.freshnessStatus}</b>
            </span>
          </div>

          <div className={`px-4 py-2 rounded-xl border flex items-center space-x-2 ${
            isApproved
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            {isApproved ? <ShieldCheck className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            <div>
              <span className="text-xs font-bold block">
                {isApproved ? 'PASSED AI INSPECTION' : 'QUALITY WARNING'}
              </span>
              <span className="text-[10px] text-slate-400">
                {isApproved ? 'Listing Approved' : 'Manual Audit Required'}
              </span>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
            <span className="text-xs text-slate-400 block mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Discoloration / Dark Spot Ratio
            </span>
            <span className="font-bold text-slate-200">{inspectionData.darkSpotAnomalyPct}% anomaly area</span>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
            <span className="text-xs text-slate-400 block mb-1 flex items-center gap-1">
              <PackageCheck className="w-3.5 h-3.5 text-emerald-400" /> Packaging Integrity
            </span>
            <span className="font-bold text-slate-200">
              {inspectionData.packagingSealed ? 'Sealed & Compliant' : 'Unsealed / Open'}
            </span>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
            <span className="text-xs text-slate-400 block mb-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-blue-400" /> CV Portion Volume Estimate
            </span>
            <span className="font-bold text-slate-200">~{inspectionData.estimatedPortions} estimated servings</span>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
            <span className="text-xs text-slate-400 block mb-1">Recommended Cold-Storage</span>
            <span className="font-bold text-emerald-400">{inspectionData.recommendedStorage}</span>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 mb-5">
          <b className="text-slate-400 block mb-0.5">Computer Vision Inspector Analysis Notes:</b>
          {inspectionData.inspectionNotes}
        </div>

        {/* Action button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-sm text-slate-200 transition"
        >
          Close Inspection Summary
        </button>

      </div>
    </div>
  );
};
