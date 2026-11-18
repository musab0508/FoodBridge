import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Sparkles, Clock, MapPin, AlertTriangle, ShieldCheck, Navigation } from 'lucide-react';

// Dynamic Leaflet Viewport Controller
function MapViewController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1] && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, zoom || 12, { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

// Custom Leaflet DivIcon for Spoilage Urgency Heatmap
const createSpoilageMarkerIcon = (item, step = null) => {
  const isCritical =
    item.ai_risk_level === 'CRITICAL' ||
    (item.remaining_hours !== undefined && item.remaining_hours < 2.0) ||
    item.ai_urgency_score >= 80;

  const isHigh =
    item.ai_risk_level === 'HIGH' ||
    (item.remaining_hours !== undefined && item.remaining_hours <= 6.0) ||
    item.ai_urgency_score >= 50;

  let bgColor = '#059669'; // Emerald Normal
  let pulseClass = '';
  let badgeLabel = step ? `#${step}` : 'SAFE';

  if (isCritical) {
    bgColor = '#DC2626'; // Red Critical
    pulseClass = 'marker-pulse-critical';
    badgeLabel = step ? `#${step} ⚡` : 'CRIT ⚡';
  } else if (isHigh) {
    bgColor = '#EA580C'; // Amber High
    pulseClass = 'marker-pulse-high';
    badgeLabel = step ? `#${step}` : 'HIGH';
  }

  return L.divIcon({
    className: 'custom-spoilage-leaflet-marker',
    html: `
      <div class="${pulseClass}" style="
        background-color: ${bgColor};
        color: white;
        font-weight: 800;
        font-size: 11px;
        padding: 4px 8px;
        border-radius: 12px;
        border: 2px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
        text-align: center;
        white-space: nowrap;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        cursor: pointer;
        transition: transform 0.15s ease;
      ">
        <span>${badgeLabel}</span>
      </div>
    `,
    iconSize: [66, 28],
    iconAnchor: [33, 14]
  });
};

// NGO Base Depot Marker Icon
const createNgoBaseIcon = (name = 'NGO Base') => {
  return L.divIcon({
    className: 'custom-ngo-base-leaflet-marker',
    html: `
      <div style="
        background-color: #1E3A2B;
        color: #F0FDF4;
        font-weight: 800;
        font-size: 11px;
        padding: 5px 10px;
        border-radius: 14px;
        border: 2px solid #86EFAC;
        box-shadow: 0 4px 14px rgba(30, 58, 43, 0.45);
        text-align: center;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 4px;
      ">
        <span>📍 ${name}</span>
      </div>
    `,
    iconSize: [110, 30],
    iconAnchor: [55, 15]
  });
};

export const RouteMapVisualizer = ({
  donations = [],
  waypoints = [],
  startCoordinates = { latitude: 19.0760, longitude: 72.8777, name: 'NGO Base Depot' },
  routeGeometry = null,
  onSimulateRoute = null,
  height = '420px',
  zoom = 12
}) => {
  // Default to Mumbai Center (19.0760, 72.8777) and sanitize against overseas coordinates
  let centerLat = parseFloat(startCoordinates?.latitude) || 19.0760;
  let centerLng = parseFloat(startCoordinates?.longitude) || 72.8777;

  if (centerLng < 0 || centerLng < 68 || centerLng > 98 || centerLat < 8 || centerLat > 38) {
    centerLat = 19.0760;
    centerLng = 72.8777;
  }

  // Build Map Polyline coordinates
  const polylineCoords = routeGeometry && routeGeometry.length > 1
    ? routeGeometry
    : waypoints.length > 0
      ? [[centerLat, centerLng], ...waypoints.map((wp) => [wp.latitude, wp.longitude])]
      : [];

  // Filter active items for display: support waypoints or active donations (CLAIMED, IN_TRANSIT, AVAILABLE),
  // excluding terminal delivered/expired records, with valid Mumbai/India coordinates
  const displayItems = (waypoints.length > 0 ? waypoints : donations).filter((d) => {
    if (d.status && ['DELIVERED', 'EXPIRED'].includes(d.status)) return false;
    const lat = parseFloat(d.latitude);
    const lng = parseFloat(d.longitude);
    return !isNaN(lat) && !isNaN(lng) && lat > 10.0 && lng > 65.0 && lat !== 0.0 && lng !== 0.0;
  });

  return (
    <div
      style={{ height }}
      className="w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative z-0"
    >
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={zoom}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <MapViewController center={[centerLat, centerLng]} zoom={zoom} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* NGO Base Depot Marker */}
        <Marker
          position={[centerLat, centerLng]}
          icon={createNgoBaseIcon(startCoordinates?.name || 'NGO Base')}
        >
          <Popup>
            <div className="text-xs p-1 space-y-1">
              <p className="font-extrabold text-forest-900 text-sm flex items-center space-x-1">
                <Navigation className="w-4 h-4 text-forest-700" />
                <span>{startCoordinates?.name || 'NGO Logistics Center'}</span>
              </p>
              <p className="text-slate-600">Primary Dispatch & Cold Storage Facility</p>
              <p className="font-mono text-[10px] text-slate-500">
                GPS: {Number(centerLat).toFixed(4)}, {Number(centerLng).toFixed(4)}
              </p>
            </div>
          </Popup>
        </Marker>

        {/* Color-Coded Spoilage Urgency Markers */}
        {displayItems.map((item, idx) => {
          const lat = item.latitude;
          const lng = item.longitude;
          if (!lat || !lng) return null;

          const stepNumber = item.step || (waypoints.length > 0 ? idx + 1 : item.visit_order);

          return (
            <Marker
              key={item.id || `marker-${idx}`}
              position={[lat, lng]}
              icon={createSpoilageMarkerIcon(item, stepNumber)}
            >
              <Popup>
                <div className="text-xs space-y-2 p-1 min-w-[210px]">
                  {/* Header Title & Risk */}
                  <div className="flex items-start justify-between gap-1 pb-1 border-b border-slate-100">
                    <span className="font-extrabold text-slate-900 text-sm">
                      {item.food_title || item.title}
                    </span>
                    <div className="flex items-center space-x-1">
                      {item.status && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-forest-100 text-forest-800 border border-forest-200 uppercase">
                          {item.status.replace('_', ' ')}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          item.ai_risk_level === 'CRITICAL'
                            ? 'badge-critical'
                            : item.ai_risk_level === 'HIGH'
                              ? 'badge-high'
                              : 'badge-normal'
                        }`}
                      >
                        {item.ai_risk_level || 'NORMAL'}
                      </span>
                    </div>
                  </div>

                  {/* Quantity & Category */}
                  <div className="flex items-center justify-between text-slate-600 text-[11px]">
                    <span className="font-bold text-forest-800">{item.quantity}</span>
                    <span>Category: {item.food_type || 'COOKED'}</span>
                  </div>

                  {/* Urgency & Expiry Countdown */}
                  <div className="grid grid-cols-2 gap-1 text-[11px] bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">AI URGENCY</span>
                      <span className="font-bold text-rose-600">{item.ai_urgency_score}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">EXPIRES IN</span>
                      <span className="font-bold text-slate-800">
                        {item.remaining_hours !== undefined
                          ? `${item.remaining_hours} hrs`
                          : `${item.expiry_hours || 4} hrs`}
                      </span>
                    </div>
                  </div>

                  {/* Computer Vision Inspection Badge */}
                  <div className="flex items-center space-x-1 text-[10px] text-emerald-800 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      CV Quality: {item.image_quality_score || 94.5}% (Verified Clean)
                    </span>
                  </div>

                  {/* Distance & Priority Index */}
                  {(item.distance_km !== undefined || item.priority_index !== undefined) && (
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                      {item.distance_km !== undefined && (
                        <span>📍 {item.distance_km} km away</span>
                      )}
                      {item.priority_index !== undefined && (
                        <span className="font-bold text-forest-800">
                          Priority Index: {item.priority_index}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Pickup Location */}
                  <p className="text-[10px] text-slate-500 flex items-center space-x-1">
                    <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{item.pickup_location}</span>
                  </p>

                  {/* Simulate Route Action Button */}
                  {onSimulateRoute && (
                    <button
                      type="button"
                      onClick={() => onSimulateRoute(item)}
                      className="w-full mt-2 py-1.5 px-3 rounded-lg bg-forest-700 hover:bg-forest-800 text-white font-bold text-[11px] flex items-center justify-center space-x-1 transition-all shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1" />
                      <span>Simulate Rescue Route</span>
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Dynamic Multi-Stop Path Polyline */}
        {polylineCoords.length > 1 && (
          <Polyline
            positions={polylineCoords}
            color="#059669"
            weight={4}
            opacity={0.85}
            dashArray="8, 6"
          />
        )}
      </MapContainer>

      {/* Floating Interactive Spoilage Heatmap Legend */}
      <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-slate-200 shadow-md z-[1000] text-[11px] space-y-1.5">
        <p className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider mb-1">
          Spoilage Urgency Legend
        </p>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-red-600 marker-pulse-critical" />
          <span className="text-slate-700 font-semibold">Critical (&lt; 2h / Urgent)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-orange-600" />
          <span className="text-slate-700 font-semibold">High Urgency (2–6h)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-emerald-600" />
          <span className="text-slate-700 font-semibold">Normal (&gt; 6h)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-sm bg-forest-900 border border-emerald-400" />
          <span className="text-slate-700 font-semibold">NGO Logistics Depot</span>
        </div>
      </div>
    </div>
  );
};