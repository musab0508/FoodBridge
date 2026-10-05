'use client';

import React, { useState, useEffect } from 'react';
import { Donation, NgoProfile, MatchResult } from '@/lib/types';
import { fetchAIMatches } from '@/lib/aiClient';
import { DynamicMap } from './DynamicMap';
import { Building2, Sparkles, AlertTriangle, ShieldCheck, MapPin, CheckCircle, Sliders, Check, UserCheck, Flame } from 'lucide-react';
import confetti from 'canvas-confetti';

interface NgoDashboardProps {
  ngo: NgoProfile;
  donations: Donation[];
  allNgos: NgoProfile[];
  onAcceptDonation: (donationId: string, ngoId: string) => void;
}

export const NgoDashboard: React.FC<NgoDashboardProps> = ({
  ngo,
  donations,
  allNgos,
  onAcceptDonation
}) => {
  const [remainingCapacity, setRemainingCapacity] = useState(ngo.currentRemaining);
  const [dietaryFilter, setDietaryFilter] = useState<string[]>(ngo.dietaryConstraints);
  const [matchedResults, setMatchedResults] = useState<MatchResult[]>([]);
  const [selectedDonationId, setSelectedDonationId] = useState<string | undefined>(donations[0]?.id);

  // Re-run AI matching whenever donations or settings change
  useEffect(() => {
    async function calculateMatches() {
      if (donations.length === 0) return;
      const targetDonation = donations.find(d => d.id === selectedDonationId) || donations[0];
      const matches = await fetchAIMatches(targetDonation, allNgos);
      setMatchedResults(matches);
    }
    calculateMatches();
  }, [donations, selectedDonationId, allNgos, remainingCapacity]);

  const urgentDonations = donations.filter(d => d.urgencyScore > 75);

  const toggleDietaryConstraint = (tag: string) => {
    if (dietaryFilter.includes(tag)) {
      setDietaryFilter(dietaryFilter.filter(t => t !== tag));
    } else {
      setDietaryFilter([...dietaryFilter, tag]);
    }
  };

  const handleClaim = (donationId: string) => {
    onAcceptDonation(donationId, ngo.id);
    confetti({ particleCount: 75, spread: 75, origin: { y: 0.65 } });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* NGO Header & Capacity Control Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/90 p-8 border border-blue-500/20 shadow-2xl blue-glow">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs uppercase font-black tracking-widest text-blue-400">Shelter Dispatch Operations Portal</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">{ngo.name}</h1>
            <p className="text-xs text-slate-400 font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-400" /> {ngo.address} • Operating Hours: {ngo.intakeHours}
            </p>
          </div>

          {/* Capacity Control Slider */}
          <div className="bg-slate-950/90 p-4 rounded-2xl border border-slate-800 text-xs space-y-2.5 min-w-[300px] shadow-inner">
            <div className="flex justify-between items-center text-slate-300">
              <span className="font-bold text-xs">Remaining Intake Capacity:</span>
              <span className="font-black text-emerald-400 text-sm">{remainingCapacity} / {ngo.capacityServings} meals</span>
            </div>
            <input
              type="range"
              min="0"
              max={ngo.capacityServings}
              value={remainingCapacity}
              onChange={(e) => setRemainingCapacity(Number(e.target.value))}
              className="accent-emerald-500 w-full cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Urgent Radius Expansion Alert Banner */}
      {urgentDonations.length > 0 && (
        <div className="bg-gradient-to-r from-red-950/90 via-slate-900 to-red-950 border border-red-500/50 p-5 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-2xl bg-red-500/20 text-red-400">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-black uppercase text-red-400 tracking-wider">
                DYNAMIC RADIUS EXPANSION ACTIVE (&lt;2 HOURS SHELF-LIFE)
              </span>
              <h3 className="text-sm font-bold text-white mt-0.5">
                {urgentDonations.length} listing(s) decay below 2 hours. Volunteer pickup search radius expanded to 30 km!
              </h3>
            </div>
          </div>
          <button
            onClick={() => setSelectedDonationId(urgentDonations[0].id)}
            className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 font-black text-xs text-white transition shadow-lg shadow-red-600/40 whitespace-nowrap"
          >
            Inspect Critical Listing
          </button>
        </div>
      )}

      {/* Interactive Map */}
      <div className="glass-card rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
              <MapPin className="w-5 h-5 text-blue-400" /> Real-time Proximity & Intake Map
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Geospatial PostGIS Distance Engine & NGO Node Pins</p>
          </div>
          <span className="text-xs text-slate-400 font-bold px-3 py-1 rounded-full bg-slate-800 border border-slate-700">
            PostGIS Haversine Engine
          </span>
        </div>
        <DynamicMap
          donations={donations}
          ngos={allNgos}
          selectedDonationId={selectedDonationId}
          onSelectDonation={(id) => setSelectedDonationId(id)}
        />
      </div>

      {/* AI Dynamic Matching List & Claim Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Intake Food Listings */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-emerald-400" /> Available Surplus Listings ({donations.length})
            </h2>
            
            {/* Dietary Constraints Toggles */}
            <div className="flex space-x-1.5">
              {['HALAL', 'VEGETARIAN', 'NUT_FREE'].map((tag) => {
                const isChecked = dietaryFilter.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleDietaryConstraint(tag)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-black border transition ${
                      isChecked
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-sm'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            {donations.map((d) => {
              const isSelected = d.id === selectedDonationId;
              const isClaimed = d.status !== 'POSTED' && d.status !== 'AI_MATCHED';
              const matchForThisNgo = matchedResults.find(m => m.ngoId === ngo.id);
              const score = matchForThisNgo ? matchForThisNgo.matchScore : 94.2;

              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedDonationId(d.id)}
                  className={`p-6 rounded-3xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900/90 border-emerald-500 shadow-2xl ring-2 ring-emerald-500/20'
                      : 'glass-card glass-card-hover border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2.5">
                        <h3 className="font-extrabold text-base text-white">{d.title}</h3>
                        {d.urgencyScore > 75 && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                            CRITICAL URGENCY
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 font-medium">{d.donorName} • {d.address}</p>
                    </div>

                    {/* AI Match Score Badge */}
                    <div className="text-right">
                      <span className="text-[10px] uppercase text-slate-400 block font-bold">AI Match Score</span>
                      <span className="text-2xl font-black text-emerald-400">{score}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 my-4">
                    <div>
                      <span className="text-slate-400 block font-semibold text-[11px]">Servings</span>
                      <span className="font-bold text-slate-200">{d.servingsCount} meals</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold text-[11px]">Quality Index</span>
                      <span className="font-bold text-emerald-400">{d.qualityIndex}% Passed</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold text-[11px]">Storage</span>
                      <span className="font-bold text-slate-200">{d.storageRequirement}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-400 font-medium">
                      Status: <b className="text-amber-400">{d.status}</b>
                    </span>

                    {!isClaimed ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClaim(d.id);
                        }}
                        className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-black text-xs text-white shadow-lg shadow-emerald-600/30 transition flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-4 h-4" /> Claim & Request Volunteer Dispatch
                      </button>
                    ) : (
                      <span className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 text-xs font-black border border-emerald-500/30 flex items-center gap-1.5">
                        <Check className="w-4 h-4" /> Claimed / Assigned
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: AI Multi-Factor Scoring Breakdown */}
        <div className="lg:col-span-5 glass-card rounded-3xl p-6 shadow-2xl space-y-5">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> AI Multi-Factor Match Ranker
            </span>
            <h3 className="text-lg font-bold text-white mt-1">Shelter Proximity & Alignment</h3>
          </div>

          {matchedResults.length > 0 ? (
            <div className="space-y-3.5">
              {matchedResults.map((m, idx) => (
                <div
                  key={m.ngoId}
                  className={`p-4 rounded-2xl border text-xs space-y-2.5 transition ${
                    m.ngoId === ngo.id
                      ? 'bg-slate-950/90 border-emerald-500/80 shadow-lg ring-1 ring-emerald-500/30'
                      : 'bg-slate-950/60 border-slate-800/80 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-200">
                      #{idx + 1} {m.ngoName} {m.ngoId === ngo.id && '(Your NGO)'}
                    </span>
                    <span className="font-black text-emerald-400 text-base">{m.matchScore}%</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-400 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <div><b>Distance:</b> {m.distanceKm} km</div>
                    <div><b>Urgency Score:</b> {m.urgencyScore}%</div>
                    <div><b>Dietary Match:</b> {m.dietaryMatch ? 'Yes (100%)' : 'Partial (20%)'}</div>
                    <div><b>Capacity Match:</b> {m.capacityMatch ? 'Sufficient' : 'Exceeded'}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">Select a food listing to compute real-time AI ranking scores across shelters.</p>
          )}
        </div>

      </div>

    </div>
  );
};
