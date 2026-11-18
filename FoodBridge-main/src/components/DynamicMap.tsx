'use client';

import React, { useEffect, useState } from 'react';
import { Donation, NgoProfile, VolunteerProfile } from '@/lib/types';

interface DynamicMapProps {
  donations?: Donation[];
  ngos?: NgoProfile[];
  volunteers?: VolunteerProfile[];
  selectedDonationId?: string;
  onSelectDonation?: (donationId: string) => void;
  polylinePoints?: [number, number][];
  center?: [number, number];
  zoom?: number;
}

export const DynamicMap: React.FC<DynamicMapProps> = ({
  donations = [],
  ngos = [],
  volunteers = [],
  selectedDonationId,
  onSelectDonation,
  polylinePoints = [],
  center = [19.0760, 72.8777], // Mumbai Center
  zoom = 12
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-[450px] bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-800 text-slate-500 animate-pulse">
        Initializing OpenStreetMap Geospatial Telemetry View (Mumbai MMR)...
      </div>
    );
  }

  // Load React Leaflet dynamically on client side
  const { MapContainer, TileLayer, Marker, Popup, Polyline } = require('react-leaflet');
  const L = require('leaflet');
  require('leaflet/dist/leaflet.css');

  // Custom Icon Helpers
  const createCustomIcon = (color: string, label: string) => {
    return L.divIcon({
      className: 'custom-leaflet-marker',
      html: `
        <div style="
          background: ${color};
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 4px 10px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 11px;
        ">${label}</div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  };

  const donorIcon = createCustomIcon('#22c55e', 'D'); // Green for Donor
  const ngoIcon = createCustomIcon('#3b82f6', 'NGO'); // Blue for NGO
  const volIcon = createCustomIcon('#eab308', 'V'); // Yellow for Volunteer
  const urgentIcon = createCustomIcon('#ef4444', '⚡'); // Red for Urgent Expiry

  return (
    <div className="w-full h-[450px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative z-10">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Donation Markers */}
        {donations.map((d) => {
          const isUrgent = d.urgencyScore > 75;
          return (
            <Marker
              key={d.id}
              position={[d.latitude, d.longitude]}
              icon={isUrgent ? urgentIcon : donorIcon}
              eventHandlers={{
                click: () => onSelectDonation && onSelectDonation(d.id),
              }}
            >
              <Popup className="custom-popup">
                <div className="p-1 max-w-xs">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-slate-900 text-sm">{d.donorName}</span>
                    {isUrgent && (
                      <span className="bg-red-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded">
                        &lt;2h URGENT
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-700 mb-2 font-medium">{d.title}</p>
                  <div className="text-[11px] text-slate-600 space-y-0.5">
                    <div><b>Servings:</b> {d.servingsCount} | <b>Weight:</b> {d.weightKg} kg</div>
                    <div><b>Urgency Score:</b> <span className="font-bold text-amber-600">{d.urgencyScore}%</span></div>
                    <div><b>Category:</b> {d.category}</div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* NGO Markers */}
        {ngos.map((ngo) => (
          <Marker
            key={ngo.id}
            position={[ngo.latitude, ngo.longitude]}
            icon={ngoIcon}
          >
            <Popup>
              <div className="p-1">
                <span className="font-bold text-slate-900 text-sm block">{ngo.name}</span>
                <p className="text-xs text-slate-600">Remaining Intake: <b>{ngo.currentRemaining}</b> servings</p>
                <div className="text-[10px] text-slate-500 mt-1">Intake Hours: {ngo.intakeHours}</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Volunteer Markers */}
        {volunteers.map((vol) => (
          <Marker
            key={vol.id}
            position={[vol.latitude, vol.longitude]}
            icon={volIcon}
          >
            <Popup>
              <div className="p-1">
                <span className="font-bold text-slate-900 text-sm block">{vol.name}</span>
                <p className="text-xs text-slate-600">Vehicle: {vol.vehicleType}</p>
                <p className="text-xs text-emerald-700 font-semibold">Live GPS Active</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Optimized Polyline Path */}
        {polylinePoints.length > 1 && (
          <Polyline
            positions={polylinePoints}
            color="#10b981"
            weight={4}
            dashArray="8, 8"
          />
        )}
      </MapContainer>
    </div>
  );
};
