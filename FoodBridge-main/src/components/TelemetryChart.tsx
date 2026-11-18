'use client';

import React from 'react';
import { TelemetryReading } from '@/lib/types';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { Thermometer, Droplets, ShieldCheck, AlertTriangle } from 'lucide-react';

interface TelemetryChartProps {
  data: TelemetryReading[];
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({ data }) => {
  const latest = data[data.length - 1] || { temperatureC: 4.5, humidityPct: 63, thermalBreach: false };
  const isBreach = latest.temperatureC > 8.0 || latest.temperatureC < 2.0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-xl ${isBreach ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            <Thermometer className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">IoT Container Cold-Chain Telemetry</h3>
            <p className="text-xs text-slate-400">Live Temperature (°C) & Humidity Sensor Log</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Current Temp</span>
            <span className={`text-lg font-extrabold ${isBreach ? 'text-red-400' : 'text-emerald-400'}`}>
              {latest.temperatureC.toFixed(1)} °C
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Humidity</span>
            <span className="text-lg font-extrabold text-blue-400">
              {latest.humidityPct.toFixed(0)}%
            </span>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
            isBreach ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
          }`}>
            {isBreach ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5" /> Thermal Breach Alert
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5" /> Thermal Safe (2-8°C)
              </>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="timestamp" stroke="#94a3b8" fontSize={11} />
            <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 12]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem' }}
              labelStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
            />
            <ReferenceLine y={8.0} label={{ value: 'Upper Max (8°C)', fill: '#ef4444', fontSize: 10 }} stroke="#ef4444" strokeDasharray="4 4" />
            <ReferenceLine y={2.0} label={{ value: 'Lower Min (2°C)', fill: '#3b82f6', fontSize: 10 }} stroke="#3b82f6" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="temperatureC" name="Temp (°C)" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="humidityPct" name="Humidity (%)" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
