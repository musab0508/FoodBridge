import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Custom Leaflet Pin Markers
const createStepIcon = (step, isStart = false) => {
  const color = isStart ? '#1E3A2B' : '#059669';
  const label = isStart ? 'START' : `Stop #${step}`;
  
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div style="background-color:${color}; color:white; font-weight:800; font-size:11px; padding:4px 8px; border-radius:12px; border:2px solid white; box-shadow:0 4px 10px rgba(0,0,0,0.25); text-align:center; white-space:nowrap;">${label}</div>`,
    iconSize: [60, 28],
    iconAnchor: [30, 14]
  });
};

export const RouteMapVisualizer = ({ waypoints = [], startCoordinates = { latitude: 37.7749, longitude: -122.4194 } }) => {
  const centerLat = startCoordinates?.latitude || (waypoints[0]?.latitude || 37.7749);
  const centerLng = startCoordinates?.longitude || (waypoints[0]?.longitude || -122.4194);

  // Construct Polyline positions array
  const polylinePositions = [
    [centerLat, centerLng],
    ...waypoints.map((wp) => [wp.latitude, wp.longitude])
  ];

  return (
    <div className="w-full h-[380px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative z-0">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={13}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Start Location Marker */}
        <Marker position={[centerLat, centerLng]} icon={createStepIcon(0, true)}>
          <Popup>
            <div className="text-xs p-1">
              <p className="font-bold text-slate-900">Volunteer Start Location</p>
              <p className="text-slate-600">Base Depot / Volunteer Position</p>
            </div>
          </Popup>
        </Marker>

        {/* Waypoint Markers */}
        {waypoints.map((wp) => (
          <Marker
            key={wp.step || wp.id}
            position={[wp.latitude, wp.longitude]}
            icon={createStepIcon(wp.step)}
          >
            <Popup>
              <div className="text-xs space-y-1 p-1">
                <span className="font-extrabold text-forest-800">Stop #{wp.step}: {wp.title}</span>
                <p className="text-slate-600">Quantity: {wp.quantity}</p>
                <p className="text-slate-500 font-semibold">{wp.pickup_location}</p>
                <p className="text-[10px] text-emerald-700 font-bold">AI Urgency: {wp.ai_urgency_score}%</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Multi-Stop Path Polyline */}
        {polylinePositions.length > 1 && (
          <Polyline
            positions={polylinePositions}
            color="#2D5237"
            weight={4}
            opacity={0.8}
            dashArray="8, 8"
          />
        )}
      </MapContainer>
    </div>
  );
};
