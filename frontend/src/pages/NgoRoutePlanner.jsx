import React, { useState, useEffect } from 'react';
import { donationService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RouteMapVisualizer } from '../components/RouteMapVisualizer';
import { Route, Navigation, MapPin, Clock, Truck, CheckSquare, Square, Sparkles, ArrowRight } from 'lucide-react';

export const NgoRoutePlanner = () => {
  const { user } = useAuth();
  const [claimedDonations, setClaimedDonations] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [routePlan, setRoutePlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);

  const [volunteerLat, setVolunteerLat] = useState(user?.profile?.latitude || 37.7749);
  const [volunteerLng, setVolunteerLng] = useState(user?.profile?.longitude || -122.4194);

  const fetchClaimed = async () => {
    try {
      setLoading(true);
      const all = await donationService.getDonations();
      const claimed = all.filter(
        (d) => d.claimed_by && d.claimed_by.id === user.id && d.status !== 'DELIVERED'
      );
      setClaimedDonations(claimed);
      setSelectedIds(claimed.map((d) => d.id));
    } catch (err) {
      console.error('Failed to load claimed donations for route planning:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaimed();
  }, []);

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleGenerateRoute = async () => {
    setOptimizing(true);
    try {
      const plan = await donationService.optimizeRoute(volunteerLat, volunteerLng, selectedIds);
      setRoutePlan(plan);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to calculate optimal route.');
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Route Planner Header */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-forest-700">AI Route Dispatcher & Logistics Planner</span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1">Multi-Stop Rescue Logistics</h1>
          <p className="text-xs text-slate-600 mt-1">
            Optimize volunteer pickup paths combining PostGIS spatial distance and AI Urgency scores to reduce fuel costs.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs font-semibold text-forest-900 bg-forest-50 px-3.5 py-2 rounded-xl border border-forest-200">
          <Route className="w-4 h-4 text-forest-700" />
          <span>TSP Route Optimization</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Select Items & Generate Route */}
        <div className="lg:col-span-1 space-y-6">
          <div className="organic-card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <CheckSquare className="w-5 h-5 text-forest-700" />
              <span>Select Claimed Pickups ({selectedIds.length}/{claimedDonations.length})</span>
            </h2>

            {loading ? (
              <p className="text-xs text-slate-500">Loading claimed items...</p>
            ) : claimedDonations.length === 0 ? (
              <div className="p-4 text-center border border-dashed border-slate-200 rounded-xl">
                <p className="text-xs text-slate-500 font-medium">No claimed donations available for routing.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {claimedDonations.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggleSelect(item.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start space-x-3 text-xs ${
                      selectedIds.includes(item.id)
                        ? 'bg-forest-50 border-forest-300 text-forest-900 font-semibold'
                        : 'bg-warm-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    {selectedIds.includes(item.id) ? (
                      <CheckSquare className="w-4 h-4 text-forest-700 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold text-slate-900">{item.food_title}</p>
                      <p className="text-[11px] text-slate-500">{item.quantity} • AI Score: {item.ai_urgency_score}%</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Volunteer Start Coordinates */}
            <div className="pt-2 border-t border-slate-200 space-y-3">
              <label className="block text-[11px] font-bold text-slate-700 uppercase">Volunteer Depot Coordinates</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500">Latitude</span>
                  <input
                    type="number"
                    step="any"
                    value={volunteerLat}
                    onChange={(e) => setVolunteerLat(parseFloat(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Longitude</span>
                  <input
                    type="number"
                    step="any"
                    value={volunteerLng}
                    onChange={(e) => setVolunteerLng(parseFloat(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerateRoute}
              disabled={optimizing || selectedIds.length === 0}
              className="w-full py-3 px-4 rounded-xl font-bold bg-forest-700 text-white hover:bg-forest-800 transition-all shadow-sm text-xs flex items-center justify-center space-x-2 disabled:opacity-40"
            >
              {optimizing ? (
                <span>Solving TSP Path...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Optimal Pickup Route</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Columns: Route Summary & Interactive Map */}
        <div className="lg:col-span-2 space-y-6">
          {routePlan && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm text-center">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Total Route Distance</p>
                <p className="text-2xl font-extrabold text-forest-900 mt-1">{routePlan.total_distance_km} km</p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm text-center">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Est. Total Drive Time</p>
                <p className="text-2xl font-extrabold text-forest-900 mt-1">{routePlan.total_drive_time_mins} mins</p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm text-center">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Total Stops Rescued</p>
                <p className="text-2xl font-extrabold text-forest-900 mt-1">{routePlan.total_items_rescued} Locations</p>
              </div>
            </div>
          )}

          {/* Interactive Leaflet Map Visualizer */}
          <div className="organic-card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Navigation className="w-5 h-5 text-forest-700" />
              <span>Interactive Route Visualizer (OpenStreetMap)</span>
            </h2>

            <RouteMapVisualizer
              waypoints={routePlan?.waypoints || []}
              startCoordinates={{ latitude: volunteerLat, longitude: volunteerLng }}
            />
          </div>

          {/* Step-by-Step Waypoint Order */}
          {routePlan?.waypoints && (
            <div className="organic-card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Truck className="w-5 h-5 text-forest-700" />
                <span>Ordered Multi-Stop Route Dispatch Checklist</span>
              </h2>

              <div className="space-y-3">
                {routePlan.waypoints.map((wp) => (
                  <div key={wp.step} className="p-3.5 rounded-xl bg-warm-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-3">
                      <span className="w-7 h-7 rounded-full bg-forest-700 text-white font-extrabold flex items-center justify-center text-xs">
                        #{wp.step}
                      </span>
                      <div>
                        <p className="font-bold text-slate-900">{wp.title}</p>
                        <p className="text-slate-600">{wp.quantity} • {wp.pickup_location}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-forest-800">+{wp.distance_from_prev_km} km</span>
                      <p className="text-[10px] text-slate-500 font-semibold">Urgency: {wp.ai_urgency_score}%</p>
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
