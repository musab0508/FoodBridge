'use client';

import React, { useState, useEffect } from 'react';
import { VolunteerProfile, Donation, NgoProfile, TelemetryReading, OptimizedRoute } from '@/lib/types';
import { fetchOptimizedRoute } from '@/lib/aiClient';
import { DynamicMap } from './DynamicMap';
import { TelemetryChart } from './TelemetryChart';
import { QRHandoffModal } from './QRHandoffModal';
import { Navigation, QrCode, ShieldCheck, Truck, CheckCircle2, Clock, MapPin, Zap, Bike } from 'lucide-react';

interface VolunteerDashboardProps {
  volunteer: VolunteerProfile;
  donations: Donation[];
  ngos: NgoProfile[];
  telemetryLogs: TelemetryReading[];
  onUpdateDonationStatus: (donationId: string, status: any, tokenHash?: string) => void;
}

export const VolunteerDashboard: React.FC<VolunteerDashboardProps> = ({
  volunteer,
  donations,
  ngos,
  telemetryLogs,
  onUpdateDonationStatus
}) => {
  const [routeInfo, setRouteInfo] = useState<OptimizedRoute | null>(null);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [qrAction, setQrAction] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [activeDonationId, setActiveDonationId] = useState<string>(donations[0]?.id || 'don_101');

  const activeNGO = ngos[0];

  useEffect(() => {
    async function loadRoute() {
      if (donations.length === 0) return;
      const res = await fetchOptimizedRoute(
        volunteer.latitude,
        volunteer.longitude,
        donations,
        activeNGO
      );
      setRouteInfo(res);
    }
    loadRoute();
  }, [donations, volunteer, activeNGO]);

  const handleOpenQr = (donationId: string, action: 'PICKUP' | 'DELIVERY') => {
    setActiveDonationId(donationId);
    setQrAction(action);
    setIsQrOpen(true);
  };

  const handleHandoffSuccess = (action: 'PICKUP' | 'DELIVERY', tokenHash: string) => {
    const nextStatus = action === 'PICKUP' ? 'PICKED_UP' : 'DISTRIBUTED';
    onUpdateDonationStatus(activeDonationId, nextStatus, tokenHash);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Volunteer Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/90 p-8 border border-amber-500/20 shadow-2xl amber-glow">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs uppercase font-black tracking-widest text-amber-400">Rider & Logistics Dispatch Portal</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">{volunteer.name}</h1>
            <p className="text-xs text-slate-400 font-medium flex items-center gap-2">
              <Bike className="w-4 h-4 text-amber-400" /> Vehicle: {volunteer.vehicleType} • Payload: {volunteer.activePayloadKg} kg / {volunteer.maxCapacityKg} kg
            </p>
          </div>

          <div className="flex items-center space-x-4 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 shadow-inner">
            <div className="text-right">
              <span className="text-[11px] text-slate-400 block font-semibold">GPS Telemetry Status</span>
              <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5 justify-end mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Live Navigation
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* IoT Cold-Chain Container Telemetry Monitor */}
      <TelemetryChart data={telemetryLogs} />

      {/* Map & Route Optimization Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: TSP Optimized Route Map */}
        <div className="lg:col-span-7 glass-card rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                <Navigation className="w-5 h-5 text-emerald-400" /> Multi-Stop Optimized Route Map
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Traveling Salesperson Problem (TSP) 2-Opt Edge Swap Solver</p>
            </div>
            <span className="text-xs text-amber-400 font-extrabold px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
              TSP 2-Opt Active
            </span>
          </div>

          <DynamicMap
            donations={donations}
            ngos={ngos}
            volunteers={[volunteer]}
            polylinePoints={routeInfo?.routePolylinePoints || []}
          />
        </div>

        {/* Right Column: Step-by-Step Multi-Stop Batch Checklist */}
        <div className="lg:col-span-5 glass-card rounded-3xl p-6 shadow-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs text-slate-400 block font-semibold">Batch Trip Metrics</span>
              <h3 className="text-base font-black text-white">
                {routeInfo ? `${routeInfo.totalStops} Stops • ${routeInfo.totalDistanceKm} km` : 'Calculating Route...'}
              </h3>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block font-semibold">Est Transit Time</span>
              <span className="text-sm font-black text-emerald-400">
                ~{routeInfo?.totalEstTimeMinutes || 15} mins
              </span>
            </div>
          </div>

          {/* Steps List */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase font-black tracking-wider text-slate-400">Optimized Stop Sequence:</h4>
            
            {routeInfo?.optimizedRoute.map((stop, idx) => {
              const isPickup = stop.type === 'PICKUP';
              const targetDonation = donations.find(d => d.id === stop.id);
              const isPickedUp = targetDonation?.status === 'PICKED_UP';
              const isDistributed = targetDonation?.status === 'DISTRIBUTED' || targetDonation?.status === 'AUDITED';

              return (
                <div
                  key={stop.id + idx}
                  className={`p-4 rounded-2xl border text-xs space-y-3 transition ${
                    isPickup
                      ? 'bg-slate-950/90 border-amber-500/40 shadow-md'
                      : 'bg-slate-950/90 border-blue-500/40 shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        isPickup ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        Stop #{idx + 1}: {stop.type}
                      </span>
                      <h5 className="font-extrabold text-sm text-white mt-1.5">{stop.name}</h5>
                      <p className="text-[11px] text-slate-400 font-medium">{stop.address}</p>
                    </div>

                    <div className="text-right text-slate-400 font-bold">
                      <span>+{stop.legDistanceKm} km</span>
                    </div>
                  </div>

                  {/* Action Handoff Scanner Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-[11px] text-slate-400">
                      Est Leg: <b className="text-slate-200">{stop.estLegTimeMinutes} mins</b>
                    </span>

                    {isPickup ? (
                      !isPickedUp && !isDistributed ? (
                        <button
                          onClick={() => handleOpenQr(stop.id, 'PICKUP')}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 font-extrabold text-xs flex items-center gap-1.5 transition shadow"
                        >
                          <QrCode className="w-3.5 h-3.5" /> Scan Donor Pickup QR
                        </button>
                      ) : (
                        <span className="text-emerald-400 font-extrabold text-xs flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> Pickup Verified
                        </span>
                      )
                    ) : (
                      !isDistributed ? (
                        <button
                          onClick={() => handleOpenQr(activeDonationId, 'DELIVERY')}
                          className="px-3 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/40 font-extrabold text-xs flex items-center gap-1.5 transition shadow"
                        >
                          <QrCode className="w-3.5 h-3.5" /> Scan NGO Delivery QR
                        </button>
                      ) : (
                        <span className="text-emerald-400 font-extrabold text-xs flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> Delivered & Audited
                        </span>
                      )
                    )}
                  </div>

                </div>
              );
            })}
          </div>

        </div>

      </div>

      {/* QR Code Handoff Verification Modal */}
      <QRHandoffModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        donationId={activeDonationId}
        volunteerId={volunteer.id}
        targetId={qrAction === 'PICKUP' ? 'donor_1' : 'ngo_1'}
        action={qrAction}
        onHandoffComplete={handleHandoffSuccess}
      />

    </div>
  );
};
