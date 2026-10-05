'use client';

import React, { useState } from 'react';
import { Donation, DonorProfile, FoodCategory, StorageRequirement } from '@/lib/types';
import { runVisionInspection } from '@/lib/aiClient';
import { PlusCircle, Sparkles, Clock, ShieldCheck, AlertTriangle, Eye, CheckCircle2, ChevronRight, Building2, Package, Thermometer, Calendar } from 'lucide-react';
import confetti from 'canvas-confetti';

interface DonorDashboardProps {
  donor: DonorProfile;
  donations: Donation[];
  onAddDonation: (newDonation: Partial<Donation>) => void;
  onOpenVisionModal: (donation: Donation) => void;
}

export const DonorDashboard: React.FC<DonorDashboardProps> = ({
  donor,
  donations,
  onAddDonation,
  onOpenVisionModal
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<FoodCategory>('COOKED_MEALS');
  const [servings, setServings] = useState(80);
  const [weightKg, setWeightKg] = useState(35);
  const [storageReq, setStorageReq] = useState<StorageRequirement>('HOT_CONTAINER');
  const [hoursToExpiry, setHoursToExpiry] = useState(2.5);
  
  // Vision Inspection State
  const [isScanning, setIsScanning] = useState(false);
  const [visionData, setVisionData] = useState<any>(null);

  const handleScanVision = async () => {
    setIsScanning(true);
    const result = await runVisionInspection(category);
    setVisionData(result);
    setIsScanning(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const expEta = new Date();
    expEta.setMinutes(expEta.getMinutes() + hoursToExpiry * 60);

    onAddDonation({
      donorId: donor.id,
      donorName: donor.name,
      title,
      description,
      category,
      servingsCount: Number(servings),
      weightKg: Number(weightKg),
      prepTime: new Date().toISOString(),
      expirationEta: expEta.toISOString(),
      storageRequirement: storageReq,
      status: 'POSTED',
      urgencyScore: hoursToExpiry <= 2 ? 89.0 : 38.0,
      qualityIndex: visionData ? visionData.qualityIndex : 96.5,
      spoilageRiskFlag: visionData ? visionData.spoilageRiskFlag : false,
      latitude: donor.latitude,
      longitude: donor.longitude,
      address: donor.address
    });

    confetti({ particleCount: 70, spread: 70, origin: { y: 0.65 } });
    setTitle('');
    setDescription('');
    setVisionData(null);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Donor Header Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/90 p-8 border border-emerald-500/20 shadow-2xl emerald-glow">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs uppercase font-black tracking-widest text-emerald-400">Donor Operations Portal • Greater Mumbai</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">{donor.name}</h1>
            <p className="text-xs text-slate-400 font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-400" /> {donor.orgType} • {donor.address}
            </p>
          </div>

          <div className="flex items-center space-x-4 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 shadow-inner">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-extrabold text-lg">
              ★
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-semibold">Reputation Rating</span>
              <span className="text-base font-black text-amber-400">{donor.reputationScore} / 5.0 (Verified Donor)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Surplus Food Listing Posting Form with Vision Scan */}
        <div className="lg:col-span-5 glass-card rounded-3xl p-7 shadow-2xl border border-slate-800 relative">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                <PlusCircle className="w-5 h-5 text-emerald-400" /> New Surplus Listing
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Post excess food for dynamic AI matching</p>
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Live AI Match
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Surplus Item Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., 80 Servings Luxury Buffet Lunch (Paneer & Rice)"
                className="w-full bg-slate-950/90 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-emerald-400" /> Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as FoodCategory)}
                  className="w-full bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="COOKED_MEALS">Cooked Meals</option>
                  <option value="BAKERY_PASTRY">Bakery & Pastry</option>
                  <option value="FRESH_PRODUCE">Fresh Produce</option>
                  <option value="DAIRY_PACKAGED">Dairy & Packaged</option>
                  <option value="FROZEN">Frozen Items</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
                  <Thermometer className="w-3.5 h-3.5 text-cyan-400" /> Storage Req
                </label>
                <select
                  value={storageReq}
                  onChange={(e) => setStorageReq(e.target.value as StorageRequirement)}
                  className="w-full bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="HOT_CONTAINER">Hot Container (&gt;65°C)</option>
                  <option value="REFRIGERATED">Refrigerated (2-8°C)</option>
                  <option value="AMBIENT">Ambient Room Temp</option>
                  <option value="FROZEN">Frozen (&lt;-18°C)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Servings</label>
                <input
                  type="number"
                  min="1"
                  value={servings}
                  onChange={(e) => setServings(Number(e.target.value))}
                  className="w-full bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Weight (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={weightKg}
                  onChange={(e) => setWeightKg(Number(e.target.value))}
                  className="w-full bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Expiry (Hrs)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={hoursToExpiry}
                  onChange={(e) => setHoursToExpiry(Number(e.target.value))}
                  className="w-full bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Item Description & Dietary Notes</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details e.g. 100% Veg, Halal certified, insulated hot containers..."
                rows={2}
                className="w-full bg-slate-950/90 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
              />
            </div>

            {/* AI Vision Inspector Box */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" /> OpenCV Spoilage Inspector
                </span>
                <button
                  type="button"
                  onClick={handleScanVision}
                  disabled={isScanning}
                  className="px-3 py-1.5 text-xs font-extrabold rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition flex items-center gap-1.5 shadow-sm"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {isScanning ? 'Analyzing Image...' : 'Run Vision Scan'}
                </button>
              </div>

              {visionData ? (
                <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-semibold">Freshness Score</span>
                    <span className="font-black text-emerald-400 text-sm">{visionData.qualityIndex}% • {visionData.freshnessStatus}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[11px] font-semibold">Volume Est.</span>
                    <span className="font-bold text-slate-200">~{visionData.estimatedPortions} meals</span>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic">
                  Executes simulated computer vision scan to detect discoloration, mold anomalies & packaging seals.
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-black text-sm text-white shadow-xl shadow-emerald-600/30 transition-all duration-200 flex items-center justify-center gap-2 ring-1 ring-emerald-400/30"
            >
              <PlusCircle className="w-5 h-5" /> Publish & Notify AI Dispatch Engine
            </button>
          </form>
        </div>

        {/* Right Column: Active Posted Donations & Status Tracker */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-amber-400" /> Active Posted Donations ({donations.length})
            </h2>
            <span className="text-xs text-slate-400 font-medium">Real-time workflow progress</span>
          </div>

          <div className="space-y-4">
            {donations.map((d) => {
              const isUrgent = d.urgencyScore > 75;
              return (
                <div
                  key={d.id}
                  className="glass-card glass-card-hover rounded-3xl p-6 shadow-xl space-y-4 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2.5">
                        <h3 className="font-extrabold text-lg text-white tracking-tight">{d.title}</h3>
                        {isUrgent && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                            ⚡ Urgency Boost
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 font-medium">{d.description}</p>
                    </div>

                    <button
                      onClick={() => onOpenVisionModal(d)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-emerald-400 border border-slate-700/80 text-xs font-extrabold flex items-center gap-1.5 transition shadow"
                    >
                      <Eye className="w-4 h-4" /> {d.qualityIndex}% Quality
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80">
                    <div>
                      <span className="text-slate-400 block font-semibold text-[11px]">Servings & Weight</span>
                      <span className="font-bold text-slate-200 text-xs">{d.servingsCount} meals ({d.weightKg} kg)</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold text-[11px]">Storage Req</span>
                      <span className="font-bold text-emerald-400 text-xs">{d.storageRequirement}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold text-[11px]">AI Urgency Score</span>
                      <span className={`font-black text-xs ${isUrgent ? 'text-red-400' : 'text-amber-400'}`}>
                        {d.urgencyScore}%
                      </span>
                    </div>
                  </div>

                  {/* Workflow Lifecycle Steps Bar */}
                  <div className="pt-1">
                    <span className="text-[11px] font-bold text-slate-400 block mb-2">Workflow Lifecycle:</span>
                    <div className="grid grid-cols-6 gap-1.5 text-[10px] text-center font-extrabold">
                      {['POSTED', 'AI_MATCHED', 'ACCEPTED', 'PICKED_UP', 'DISTRIBUTED', 'AUDITED'].map((st, idx) => {
                        const statuses = ['POSTED', 'AI_MATCHED', 'ACCEPTED', 'PICKED_UP', 'DISTRIBUTED', 'AUDITED'];
                        const currentIdx = statuses.indexOf(d.status);
                        const isDone = idx <= currentIdx;

                        return (
                          <div
                            key={st}
                            className={`py-2 px-1 rounded-xl border transition-all ${
                              isDone
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm'
                                : 'bg-slate-950/60 text-slate-600 border-slate-800'
                            }`}
                          >
                            {st.replace('_', ' ')}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
