'use client';

import React from 'react';
import { Role } from '@/lib/types';
import { UtensilsCrossed, ShieldAlert, Cpu, Leaf, RefreshCw, User, Building2, Bike, LayoutDashboard } from 'lucide-react';

interface NavbarProps {
  currentRole: Role;
  onRoleChange: (role: Role) => void;
  activeDonationCount: number;
  totalCo2SavedKg: number;
  onResetData?: () => void;
}

const ROLE_ICONS: Record<Role, React.ReactNode> = {
  DONOR: <Building2 className="w-3.5 h-3.5" />,
  NGO: <User className="w-3.5 h-3.5" />,
  VOLUNTEER: <Bike className="w-3.5 h-3.5" />,
  ADMIN: <LayoutDashboard className="w-3.5 h-3.5" />
};

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onRoleChange,
  activeDonationCount,
  totalCo2SavedKg,
  onResetData
}) => {
  return (
    <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 text-white shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Telemetry Status */}
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/30">
            <UtensilsCrossed className="w-5 h-5 text-slate-950 font-black" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-200 bg-clip-text text-transparent">
                FoodBridge
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shadow-sm">
                <Cpu className="w-3 h-3 animate-pulse text-emerald-400" /> AI Engine v2.4
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block font-medium">
              Real-Time AI Redistribution & Cold-Chain Telemetry
            </p>
          </div>
        </div>

        {/* Live Metrics Pill */}
        <div className="hidden lg:flex items-center space-x-4 bg-slate-900/90 px-4 py-1.5 rounded-full border border-slate-800 text-xs shadow-inner">
          <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold">
            <Leaf className="w-3.5 h-3.5 text-emerald-400" />
            <span>{totalCo2SavedKg.toFixed(1)} kg CO₂e Saved</span>
          </div>
          <div className="h-3 w-px bg-slate-800" />
          <div className="flex items-center space-x-1.5 text-amber-400 font-semibold">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{activeDonationCount} Active Listings</span>
          </div>
        </div>

        {/* Role Selector Tabs */}
        <div className="flex items-center space-x-2">
          <div className="bg-slate-900/90 p-1 rounded-xl border border-slate-800 flex space-x-1 shadow-lg">
            {(['DONOR', 'NGO', 'VOLUNTEER', 'ADMIN'] as Role[]).map((role) => {
              const isActive = currentRole === role;
              return (
                <button
                  key={role}
                  onClick={() => onRoleChange(role)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 flex items-center space-x-1.5 ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30 ring-1 ring-emerald-400/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {ROLE_ICONS[role]}
                  <span>{role}</span>
                </button>
              );
            })}
          </div>

          {onResetData && (
            <button
              onClick={onResetData}
              title="Reset Demo Dataset"
              className="p-2 text-slate-400 hover:text-emerald-400 bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800 transition shadow"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>
    </header>
  );
};

