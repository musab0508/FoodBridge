'use client';

import React, { useState } from 'react';
import { Donation, DailyForecast } from '@/lib/types';
import { calculateEsgImpact, generateEsgReceipt } from '@/lib/esgCalculator';
import { MOCK_FORECASTS } from '@/lib/mockData';
import { Shield, Leaf, Droplets, Utensils, FileText, TrendingUp, AlertTriangle, CheckCircle, Award } from 'lucide-react';

interface AdminDashboardProps {
  donations: Donation[];
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ donations }) => {
  const [selectedForecastIndex, setSelectedForecastIndex] = useState(0);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Compute aggregate ESG metrics
  const totalWeightKg = donations.reduce((acc, d) => acc + d.weightKg, 0);
  const totalServings = donations.reduce((acc, d) => acc + d.servingsCount, 0);
  const esgSummary = calculateEsgImpact(totalWeightKg, totalServings);

  const currentForecast: DailyForecast = MOCK_FORECASTS[selectedForecastIndex] || MOCK_FORECASTS[0];

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Admin Header Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-purple-950/90 p-8 border border-purple-500/20 shadow-2xl purple-glow">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
              <span className="text-xs uppercase font-black tracking-widest text-purple-400">Platform Governance & Impact Analytics</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">ESG Command & Forecasting Console</h1>
            <p className="text-xs text-slate-400 font-medium">Automated CO₂e Conversion, IRS Sec 170(e)(3) Tax Auditing & Time-Series Surplus Models</p>
          </div>

          <button
            onClick={() => setShowReceiptModal(true)}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-black text-xs text-white shadow-xl shadow-emerald-600/30 transition flex items-center gap-2 whitespace-nowrap ring-1 ring-emerald-400/30"
          >
            <FileText className="w-4 h-4" /> Export ESG Tax Audit Receipt (₹ INR)
          </button>
        </div>
      </div>

      {/* Hero ESG Impact Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        <div className="glass-card glass-card-hover rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-extrabold uppercase tracking-wider">CO₂e Avoided</span>
            <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400">
              <Leaf className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-emerald-400 tracking-tight">{esgSummary.co2SavedKg} kg</span>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">Equivalent to {esgSummary.equivalentTreesPlanted} tree-years</p>
          </div>
        </div>

        <div className="glass-card glass-card-hover rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-extrabold uppercase tracking-wider">Freshwater Saved</span>
            <div className="p-3 rounded-2xl bg-blue-500/20 text-blue-400">
              <Droplets className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-blue-400 tracking-tight">{esgSummary.waterSavedLiters.toLocaleString()} L</span>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">1,000 Liters / kg food saved</p>
          </div>
        </div>

        <div className="glass-card glass-card-hover rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-extrabold uppercase tracking-wider">Meals Rescued</span>
            <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400">
              <Utensils className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-amber-400 tracking-tight">{esgSummary.totalMealsServed}</span>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">Distributed across shelters</p>
          </div>
        </div>

        <div className="glass-card glass-card-hover rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-extrabold uppercase tracking-wider">Tax Deduction</span>
            <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-400">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-purple-400 tracking-tight">₹{esgSummary.estimatedTaxDeductionInr.toLocaleString('en-IN')}</span>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">IRS Sec 170(e)(3) Relief</p>
          </div>
        </div>

      </div>

      {/* Predictive District Surplus Hotspot Forecasting */}
      <div className="glass-card rounded-3xl p-7 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" /> Predictive Time-Series Forecasting
            </span>
            <h2 className="text-xl font-extrabold text-white mt-1">Mumbai District Surplus Hotspots (7-Day Forecast)</h2>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {MOCK_FORECASTS.map((f, idx) => (
              <button
                key={f.date}
                onClick={() => setSelectedForecastIndex(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                  selectedForecastIndex === idx
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {f.dayOfWeek} ({f.date})
              </button>
            ))}
          </div>
        </div>

        {/* Forecast District Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {currentForecast.districtForecasts.map((d) => {
            const isCritical = d.hotspotLevel === 'CRITICAL_HOTSPOT';
            return (
              <div
                key={d.districtId}
                className={`p-5 rounded-2xl border space-y-3.5 transition ${
                  isCritical
                    ? 'bg-slate-950/90 border-red-500/60 shadow-xl ring-1 ring-red-500/30'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-extrabold text-xs text-white leading-snug">{d.districtName}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase whitespace-nowrap ${
                    isCritical ? 'bg-red-500 text-white animate-pulse' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {d.hotspotLevel.replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-semibold">Exp. Surplus</span>
                    <span className="font-extrabold text-purple-400">{d.predictedSurplusKg} kg</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-semibold">Surge Prob.</span>
                    <span className="font-extrabold text-amber-400">{d.surgeProbabilityPct}%</span>
                  </div>
                </div>

                {d.proactiveNgoAlert && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-400 font-extrabold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> NGO Surge Alert Sent
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* System Audit Log */}
      <div className="glass-card rounded-3xl p-7 shadow-2xl space-y-5">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-emerald-400" /> Platform System Audit & Workflow Trail
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Chain-of-custody digital cryptographic logs</p>
        </div>

        <div className="space-y-2.5 text-xs">
          {donations.map((d) => (
            <div key={d.id} className="bg-slate-950/90 p-4 rounded-2xl border border-slate-800/80 flex items-center justify-between shadow-sm">
              <div>
                <span className="font-extrabold text-white text-sm">{d.title}</span>
                <p className="text-slate-400 text-[11px] mt-0.5 font-medium">{d.donorName} ➔ {d.address}</p>
              </div>

              <div className="flex items-center space-x-4">
                <span className="text-slate-400 font-medium">Quality Index: <b className="text-emerald-400">{d.qualityIndex}%</b></span>
                <span className="px-3.5 py-1 rounded-full font-black text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {d.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ESG Tax Receipt Modal */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 text-white space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-emerald-400">Official Mumbai ESG Social Impact Tax Receipt</h3>
            <pre className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto">
              {generateEsgReceipt('All Registered Mumbai Food Donors', esgSummary)}
            </pre>
            <button
              onClick={() => setShowReceiptModal(false)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl font-black text-sm transition"
            >
              Close Receipt Summary
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
