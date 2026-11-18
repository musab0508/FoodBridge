import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { donationService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RouteMapVisualizer } from '../components/RouteMapVisualizer';
import {
  Route,
  Navigation,
  MapPin,
  Clock,
  Truck,
  CheckSquare,
  Square,
  Sparkles,
  Flame,
  ShieldCheck,
  RefreshCw,
  Compass,
  AlertCircle,
  PackageCheck,
  Layers
} from 'lucide-react';

const MUMBAI_PRESETS = [
  { name: 'Mumbai Center (BKC)', lat: 19.0760, lng: 72.8777 },
  { name: 'Dadar Logistics Depot', lat: 19.0178, lng: 72.8478 },
  { name: 'Bandra Food Hub', lat: 19.0596, lng: 72.8295 },
  { name: 'South Mumbai Terminal', lat: 18.9220, lng: 72.8347 },
];

export const NgoRoutePlanner = () => {
  const { user } = useAuth();

  // Helper to guarantee default NGO base coordinates initialize to Mumbai Center (19.0760, 72.8777)
  const getInitialCoordinates = () => {
    const lat = user?.profile?.latitude;
    const lng = user?.profile?.longitude;
    // Ensure coordinates are within Mumbai / India bounds (lng > 0), avoiding SF/overseas defaults
    if (lat && lng && lat > 8 && lat < 38 && lng > 68 && lng < 98) {
      return { lat, lng };
    }
    return { lat: 19.0760, lng: 72.8777 };
  };

  const initialCoords = getInitialCoordinates();
  const [volunteerLat, setVolunteerLat] = useState(initialCoords.lat);
  const [volunteerLng, setVolunteerLng] = useState(initialCoords.lng);

  // Active Rescue Mission GIS Route Plan State
  const [routePlan, setRoutePlan] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [optimizing, setOptimizing] = useState(false);
  const [simulatedFocusId, setSimulatedFocusId] = useState(null);

  // Fetch optimal rescue sequence exclusively for claimed and in-transit donations
  const fetchActiveRescueRoute = async (customIds = null) => {
    try {
      setLoadingRoute(true);
      let data;
      if (customIds && customIds.length > 0) {
        data = await donationService.optimizeRoute(volunteerLat, volunteerLng, customIds);
      } else {
        data = await donationService.getOptimizedRoutes(volunteerLat, volunteerLng);
      }
      setRoutePlan(data);
      if (!customIds && data?.ordered_donations) {
        setSelectedIds(data.ordered_donations.map((d) => d.id));
      }
    } catch (err) {
      console.error('Failed to load GIS active rescue route:', err);
    } finally {
      setLoadingRoute(false);
    }
  };

  useEffect(() => {
    fetchActiveRescueRoute();
  }, [volunteerLat, volunteerLng]);

  const handleApplyPreset = (preset) => {
    setVolunteerLat(preset.lat);
    setVolunteerLng(preset.lng);
  };

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleRecalculateSelected = async () => {
    if (selectedIds.length === 0) return;
    setOptimizing(true);
    try {
      const plan = await donationService.optimizeRoute(volunteerLat, volunteerLng, selectedIds);
      setRoutePlan(plan);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to recalculate optimal route.');
    } finally {
      setOptimizing(false);
    }
  };

  const handleFocusSpecificStop = (donation) => {
    setSimulatedFocusId(donation.id);
    donationService
      .optimizeRoute(volunteerLat, volunteerLng, [donation.id])
      .then((plan) => {
        setRoutePlan((prev) => (prev ? { ...prev, waypoints: plan.waypoints, route_geometry: plan.route_geometry } : prev));
      })
      .catch((err) => console.error('Simulate route error:', err));
  };

  const activeDonations = routePlan?.ordered_donations || [];
  const waypoints = routePlan?.waypoints || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Route Planner Header */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-forest-700">
            Intelligent GIS Spatial Logistics • Active Claims & In-Transit
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
            GIS Route Optimization & Rescue Dispatch Sequence
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Calculates optimal multi-stop rescue sequences exclusively for your claimed and in-transit pickups using Haversine distance and real-time perishability decay.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            to="/dashboard/ngo"
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all flex items-center space-x-1.5"
          >
            <PackageCheck className="w-3.5 h-3.5 text-slate-600" />
            <span>NGO Dashboard</span>
          </Link>
          <button
            onClick={() => fetchActiveRescueRoute()}
            disabled={loadingRoute}
            className="px-3.5 py-1.5 rounded-xl bg-forest-700 hover:bg-forest-800 text-white font-bold text-xs transition-all flex items-center space-x-1.5 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingRoute ? 'animate-spin' : ''}`} />
            <span>Recalculate Route</span>
          </button>
        </div>
      </div>

      {/* Logistics KPI Summary Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs text-center">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Total Rescuable Meals
          </p>
          <p className="text-2xl font-extrabold text-forest-900 mt-0.5">
            {routePlan?.total_rescuable_meals !== undefined
              ? `${routePlan.total_rescuable_meals} Meals`
              : `${activeDonations.length} Posts`}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs text-center">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Optimized Route Distance
          </p>
          <p className="text-2xl font-extrabold text-forest-900 mt-0.5">
            {routePlan?.total_distance_km !== undefined ? `${routePlan.total_distance_km} km` : '0.0 km'}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs text-center">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Est. Drive Time (@ 20 km/h)
          </p>
          <p className="text-2xl font-extrabold text-forest-900 mt-0.5">
            {routePlan?.total_drive_time_mins !== undefined ? `${routePlan.total_drive_time_mins} mins` : '0 mins'}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs text-center">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Active Rescue Queue
          </p>
          <p className="text-2xl font-extrabold text-emerald-700 mt-0.5">
            {activeDonations.length} Pickups
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Depot Coordinates & Active Rescue Queue Checklist */}
        <div className="lg:col-span-1 space-y-6">
          <div className="organic-card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Navigation className="w-5 h-5 text-forest-700" />
                <span>NGO Base Coordinates</span>
              </h2>
            </div>

            {/* Quick Location Presets */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">
                Quick Viva Demo Presets
              </label>
              <div className="grid grid-cols-2 gap-2">
                {MUMBAI_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="p-2 rounded-lg bg-slate-50 hover:bg-forest-50 hover:border-forest-300 border border-slate-200 text-left transition-all"
                  >
                    <p className="text-[11px] font-bold text-slate-800">{p.name}</p>
                    <p className="text-[9px] text-slate-500 font-mono">
                      {p.lat}, {p.lng}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Manual Lat/Lng Input */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <div>
                <span className="text-[10px] text-slate-500 font-semibold">Latitude</span>
                <input
                  type="number"
                  step="any"
                  value={volunteerLat}
                  onChange={(e) => setVolunteerLat(parseFloat(e.target.value) || 19.0760)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-mono"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-semibold">Longitude</span>
                <input
                  type="number"
                  step="any"
                  value={volunteerLng}
                  onChange={(e) => setVolunteerLng(parseFloat(e.target.value) || 72.8777)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-mono"
                />
              </div>
            </div>

            {/* Active Rescues Dispatch Queue */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 uppercase">
                  Active Mission Stops ({selectedIds.length}/{activeDonations.length})
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">VRP Sequencing</span>
              </div>

              {loadingRoute ? (
                <p className="text-xs text-slate-500 py-4 text-center">Calculating spatial priority route...</p>
              ) : activeDonations.length === 0 ? (
                <div className="p-4 text-center border border-dashed border-slate-200 rounded-xl space-y-2">
                  <p className="text-xs text-slate-600 font-medium">
                    No claimed or in-transit donations in your queue.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Claim surplus food posts from the marketplace to build dispatch rescue routes.
                  </p>
                  <Link
                    to="/dashboard/ngo"
                    className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-forest-700 text-white font-bold text-xs hover:bg-forest-800 transition-all shadow-xs"
                  >
                    Browse Available Surplus
                  </Link>
                </div>
              ) : (
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {activeDonations.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border transition-all space-y-2 text-xs ${
                        simulatedFocusId === item.id
                          ? 'bg-forest-50 border-forest-400 shadow-2xs'
                          : selectedIds.includes(item.id)
                            ? 'bg-warm-50 border-slate-200'
                            : 'bg-slate-50/60 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => toggleSelect(item.id)}
                            className="text-slate-600 hover:text-forest-700 mt-0.5"
                          >
                            {selectedIds.includes(item.id) ? (
                              <CheckSquare className="w-4 h-4 text-forest-700" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                          <span className="font-extrabold text-slate-900 truncate">
                            #{item.visit_order || idx + 1} {item.food_title}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1 flex-shrink-0">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-forest-100 text-forest-800 border border-forest-200 uppercase">
                            {item.status ? item.status.replace('_', ' ') : 'CLAIMED'}
                          </span>
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

                      <div className="flex items-center justify-between text-[11px] text-slate-600">
                        <span className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[140px]">{item.pickup_location}</span>
                        </span>
                        <span className="font-bold text-forest-800">
                          {item.distance_km} km away
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
                        <span>Meals: {item.quantity_amount || 10}</span>
                        <span className="font-extrabold text-emerald-700">
                          Priority Index: {item.priority_index}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleFocusSpecificStop(item)}
                          className="text-[10px] font-bold text-forest-700 hover:underline"
                        >
                          Focus Stop
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeDonations.length > 0 && selectedIds.length !== activeDonations.length && (
                <button
                  type="button"
                  onClick={handleRecalculateSelected}
                  disabled={optimizing || selectedIds.length === 0}
                  className="w-full py-2.5 px-3 rounded-xl font-bold bg-forest-700 text-white hover:bg-forest-800 transition-all shadow-xs text-xs flex items-center justify-center space-x-1.5 disabled:opacity-40"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{optimizing ? 'Calculating...' : `Optimize Selected (${selectedIds.length})`}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Columns: Interactive Spoilage Heatmap & Leaflet Map */}
        <div className="lg:col-span-2 space-y-6">
          <div className="organic-card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Compass className="w-5 h-5 text-forest-700" />
                <span>GIS Spoilage Heatmap & Dynamic Dispatch Route</span>
              </h2>
              <span className="text-[11px] text-slate-500 font-semibold">
                OpenStreetMap GIS Layer
              </span>
            </div>

            {/* Interactive Leaflet Map Visualizer Component */}
            <RouteMapVisualizer
              donations={activeDonations}
              waypoints={waypoints}
              routeGeometry={routePlan?.route_geometry}
              startCoordinates={{
                latitude: volunteerLat,
                longitude: volunteerLng,
                name: user?.profile?.organization_name || 'NGO Base Depot'
              }}
              onSimulateRoute={handleFocusSpecificStop}
              height="450px"
              zoom={12}
            />
          </div>

          {/* Step-by-Step Waypoint Order */}
          {waypoints.length > 0 && (
            <div className="organic-card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Truck className="w-5 h-5 text-forest-700" />
                  <span>Optimal Multi-Stop Dispatch Sequence</span>
                </h2>
                <span className="text-xs font-bold text-forest-800 bg-forest-50 px-2.5 py-1 rounded-lg border border-forest-200">
                  Algorithm: {routePlan?.algorithm_used || 'Clarke-Wright TW-P'}
                </span>
              </div>

              <div className="space-y-3">
                {waypoints.map((wp) => (
                  <div
                    key={wp.step || wp.id}
                    className="p-3.5 rounded-xl bg-warm-50 border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="w-7 h-7 rounded-full bg-forest-700 text-white font-extrabold flex items-center justify-center text-xs shadow-2xs">
                        #{wp.step}
                      </span>
                      <div>
                        <p className="font-bold text-slate-900">{wp.title || wp.food_title}</p>
                        <p className="text-slate-600">
                          {wp.quantity} • {wp.pickup_location}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-forest-800">
                        +{wp.distance_from_prev_km !== undefined ? wp.distance_from_prev_km : wp.distance_km} km
                      </span>
                      <p className="text-[10px] text-rose-600 font-bold">
                        AI Urgency: {wp.ai_urgency_score}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
