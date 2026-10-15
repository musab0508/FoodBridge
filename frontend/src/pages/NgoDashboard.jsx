import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { donationService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CountdownTimer } from '../components/CountdownTimer';
import { ImageQualityBadge } from '../components/ImageQualityBadge';
import { HeartHandshake, MapPin, Route, Truck, CheckCircle2, PackageCheck, Sparkles, Filter } from 'lucide-react';

export const NgoDashboard = () => {
  const { user } = useAuth();
  const [availableDonations, setAvailableDonations] = useState([]);
  const [myClaimedDonations, setMyClaimedDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortUrgent, setSortUrgent] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const sortParam = sortUrgent ? 'urgent' : null;
      const all = await donationService.getDonations(null, sortParam);
      
      setAvailableDonations(all.filter((d) => d.status === 'AVAILABLE'));
      setMyClaimedDonations(
        all.filter(
          (d) =>
            d.claimed_by &&
            d.claimed_by.id === user.id &&
            d.status !== 'DELIVERED'
        )
      );
    } catch (err) {
      console.error('Failed to load NGO dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [sortUrgent]);

  const handleClaim = async (id) => {
    setActionLoading(id);
    try {
      await donationService.claimDonation(id);
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to claim donation.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusTransition = async (id, nextStatus) => {
    setActionLoading(id);
    try {
      await donationService.updateDonationStatus(id, nextStatus);
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status.');
    } finally {
      setActionLoading(null);
    }
  };

  const getRiskBadgeClass = (level) => {
    switch (level) {
      case 'CRITICAL':
        return 'badge-critical';
      case 'HIGH':
        return 'badge-high';
      default:
        return 'badge-normal';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* NGO Header */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-forest-700">Verified Rescue Organization</span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
            {user?.profile?.organization_name || user?.username}
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Reg ID: <span className="font-mono text-slate-800 font-bold">{user?.profile?.registration_number || 'NGO-VERIFIED'}</span> • Priority Food Rescue Workspace
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/dashboard/ngo/route"
            className="px-4 py-2 rounded-xl bg-forest-700 text-white font-bold text-xs hover:bg-forest-800 shadow-sm flex items-center space-x-1.5 transition-all"
          >
            <Route className="w-4 h-4" />
            <span>AI Route Planner</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: In-Progress Rescue Operations */}
        <div className="space-y-6">
          <div className="organic-card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Truck className="w-5 h-5 text-forest-700" />
                <span>In-Progress Rescues ({myClaimedDonations.length})</span>
              </h2>

              {myClaimedDonations.length > 0 && (
                <Link
                  to="/dashboard/ngo/route"
                  className="text-xs font-bold text-forest-700 hover:underline flex items-center space-x-1"
                >
                  <span>Dispatch Route Map</span>
                  <Route className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-500">Loading claimed rescue items...</div>
            ) : myClaimedDonations.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl">
                <p className="text-xs font-semibold text-slate-500">No active claimed food items.</p>
                <p className="text-[11px] text-slate-400 mt-1">Claim listings from the AI feed on the right.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myClaimedDonations.map((item) => (
                  <div key={item.id} className="p-4 rounded-xl bg-warm-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 text-sm">{item.food_title}</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                        {item.status}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <CountdownTimer createdAt={item.created_at} expiryHours={item.expiry_hours} />
                      <ImageQualityBadge verified={item.image_verified} score={item.image_quality_score} />
                    </div>

                    <div className="text-xs text-slate-600 space-y-1">
                      <p><span className="font-bold text-slate-800">Donor:</span> {item.donor?.profile?.organization_name || item.donor?.username}</p>
                      <p><span className="font-bold text-slate-800">Quantity:</span> {item.quantity}</p>
                      <p className="flex items-center space-x-1 text-slate-700 pt-1">
                        <MapPin className="w-3.5 h-3.5 text-forest-700" />
                        <span>{item.pickup_location}</span>
                      </p>
                    </div>

                    {/* Stepper Workflow Buttons */}
                    <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600">Action Stepper:</span>
                      
                      {item.status === 'CLAIMED' && (
                        <button
                          onClick={() => handleStatusTransition(item.id, 'IN_TRANSIT')}
                          disabled={actionLoading === item.id}
                          className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 text-xs flex items-center space-x-1 transition-all shadow-sm"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Mark as Picked Up</span>
                        </button>
                      )}

                      {item.status === 'IN_TRANSIT' && (
                        <button
                          onClick={() => handleStatusTransition(item.id, 'DELIVERED')}
                          disabled={actionLoading === item.id}
                          className="px-3.5 py-1.5 rounded-lg bg-forest-700 text-white font-bold hover:bg-forest-800 text-xs flex items-center space-x-1 transition-all shadow-sm"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>Mark as Distributed</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI-Prioritized Available Surplus Feed */}
        <div className="space-y-6">
          <div className="organic-card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-forest-700" />
                <span>Available Surplus Feed ({availableDonations.length})</span>
              </h2>

              <button
                onClick={() => setSortUrgent(!sortUrgent)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center space-x-1.5 border transition-all ${
                  sortUrgent
                    ? 'bg-forest-50 text-forest-800 border-forest-300'
                    : 'bg-white text-slate-600 border-slate-300'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>{sortUrgent ? 'Sorted by AI Urgency' : 'Standard View'}</span>
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-500">Evaluating AI scores...</div>
            ) : availableDonations.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
                <p className="text-xs font-semibold text-slate-500">All available food has been claimed!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {availableDonations.map((item) => (
                  <div key={item.id} className="p-4 rounded-xl bg-warm-50 border border-slate-200 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-slate-900 text-sm">{item.food_title}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${getRiskBadgeClass(item.ai_risk_level)}`}>
                          {item.ai_risk_level} ({item.ai_urgency_score}%)
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Donor: <span className="font-bold text-slate-900">{item.donor?.profile?.organization_name || item.donor?.username}</span> • <span className="font-bold text-forest-800">{item.quantity}</span>
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <CountdownTimer createdAt={item.created_at} expiryHours={item.expiry_hours} />
                      <ImageQualityBadge verified={item.image_verified} score={item.image_quality_score} />
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 space-y-1">
                      <p className="font-medium text-forest-900">{item.ai_insight || `⚡ Priority pickup recommended.`}</p>
                      <p className="flex items-center space-x-1 text-slate-500 pt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.pickup_location}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => handleClaim(item.id)}
                      disabled={actionLoading === item.id}
                      className="w-full py-2.5 px-3 rounded-xl bg-forest-700 text-white font-bold hover:bg-forest-800 text-xs transition-all shadow-sm flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Claim / Accept Donation</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
