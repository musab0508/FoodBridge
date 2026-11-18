import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { donationService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CountdownTimer } from '../components/CountdownTimer';
import { ImageQualityBadge } from '../components/ImageQualityBadge';
import { HandoffVerificationPanel } from '../components/HandoffVerificationPanel';
import { RouteMapVisualizer } from '../components/RouteMapVisualizer';
import { FoodImageLightboxModal, resolveImageUrl } from '../components/FoodImageLightboxModal';
import { HeartHandshake, MapPin, Route, Truck, CheckCircle2, PackageCheck, Sparkles, Filter, Compass, Eye, Maximize2 } from 'lucide-react';

export const NgoDashboard = () => {
  const { user } = useAuth();
  const [availableDonations, setAvailableDonations] = useState([]);
  const [myClaimedDonations, setMyClaimedDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortUrgent, setSortUrgent] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedImageDonation, setSelectedImageDonation] = useState(null);

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
      setSelectedImageDonation(null);
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

  const handleVerifyAndCompleteDelivery = async (id, pin) => {
    setActionLoading(id);
    try {
      await donationService.completeDelivery(id, pin);
      await fetchData();
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to verify PIN. Delivery could not be confirmed.';
      throw new Error(errorMsg);
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
            <span>GIS Route Planner</span>
          </Link>
        </div>
      </div>

      {/* GIS Spoilage Heatmap & Spatial Rescue Dispatch Widget */}
      <div className="organic-card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <Compass className="w-5 h-5 text-forest-700" />
              <h2 className="text-base font-bold text-slate-900">
                GIS Spoilage Heatmap & Spatial Rescue Monitor
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live OpenStreetMap visualization of surplus food nodes color-coded by remaining shelf-life (🔴 Critical &lt; 2h, 🟠 High 2–6h, 🟢 Safe).
            </p>
          </div>
          <Link
            to="/dashboard/ngo/route"
            className="px-4 py-2 rounded-xl bg-forest-50 border border-forest-300 text-forest-800 font-bold text-xs hover:bg-forest-100 shadow-2xs flex items-center space-x-1.5 transition-all self-start sm:self-auto"
          >
            <Route className="w-4 h-4 text-forest-700" />
            <span>Open Multi-Stop Route Optimizer</span>
          </Link>
        </div>

        <RouteMapVisualizer
          donations={myClaimedDonations.length > 0 ? myClaimedDonations : availableDonations}
          startCoordinates={{
            latitude: user?.profile?.latitude || 19.0760,
            longitude: user?.profile?.longitude || 72.8777,
            name: user?.profile?.organization_name || 'My NGO Hub'
          }}
          height="340px"
          zoom={12}
        />
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
                {myClaimedDonations.map((item) => {
                  const hasImage = Boolean(item.image && typeof item.image === 'string' && item.image.trim().length > 0);
                  const imageUrl = hasImage ? resolveImageUrl(item.image) : null;

                  return (
                    <div key={item.id} className="p-4 rounded-xl bg-warm-50 border border-slate-200 space-y-3">
                      {/* Claimed Item Food Photo Thumbnail (only when uploaded image exists) */}
                      {hasImage && imageUrl && (
                        <div
                          onClick={() => setSelectedImageDonation(item)}
                          className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-900 h-36 w-full shadow-2xs"
                        >
                          <img
                            src={imageUrl}
                            alt={item.food_title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                          <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white text-[11px]">
                            <span className="font-semibold flex items-center space-x-1 text-white/95">
                              <Eye className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Inspect Verified Photo</span>
                            </span>
                            <span className="text-[10px] bg-black/60 px-2 py-0.5 rounded font-mono">
                              {item.quantity}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 text-sm">{item.food_title}</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                          {item.status}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <CountdownTimer createdAt={item.created_at} expiryHours={item.expiry_hours} />
                        {hasImage && item.image_verified && item.image_quality_score > 0 && (
                          <ImageQualityBadge verified={item.image_verified} score={item.image_quality_score} />
                        )}
                      </div>

                      <div className="text-xs text-slate-600 space-y-1">
                        <p><span className="font-bold text-slate-800">Donor:</span> {item.donor?.profile?.organization_name || item.donor?.username}</p>
                        <p><span className="font-bold text-slate-800">Quantity:</span> {item.quantity}</p>
                        <p className="flex items-center space-x-1 text-slate-700 pt-1">
                          <MapPin className="w-3.5 h-3.5 text-forest-700" />
                          <span>{item.pickup_location}</span>
                        </p>
                      </div>

                      {/* Cryptographic Handoff & Chain-of-Custody Verification Panel */}
                      <HandoffVerificationPanel
                        donation={item}
                        role="NGO"
                        onCompleteDelivery={handleVerifyAndCompleteDelivery}
                        actionLoading={actionLoading === item.id}
                      />

                      {/* Stepper Workflow Buttons */}
                      {item.status === 'CLAIMED' && (
                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-600">Transit Status:</span>
                          <button
                            onClick={() => handleStatusTransition(item.id, 'IN_TRANSIT')}
                            disabled={actionLoading === item.id}
                            className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 text-xs flex items-center space-x-1 transition-all shadow-sm"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Mark as Picked Up</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
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
                {availableDonations.map((item) => {
                  const hasImage = Boolean(item.image && typeof item.image === 'string' && item.image.trim().length > 0);
                  const imageUrl = hasImage ? resolveImageUrl(item.image) : null;

                  return (
                    <div key={item.id} className="p-4 rounded-2xl bg-warm-50 border border-slate-200 flex flex-col justify-between space-y-3.5 shadow-2xs hover:shadow-xs transition-shadow">
                      {/* Verified Food Photo Thumbnail (only when uploaded image exists) */}
                      {hasImage && imageUrl && (
                        <div
                          onClick={() => setSelectedImageDonation(item)}
                          className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-200/80 bg-slate-900 h-44 w-full shadow-2xs"
                        >
                          <img
                            src={imageUrl}
                            alt={item.food_title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent group-hover:from-black/85 transition-colors" />

                          {/* Top Badges: AI Urgency & OpenCV Quality */}
                          <div className="absolute top-2.5 left-2.5 flex items-center space-x-1.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shadow-sm backdrop-blur-md ${getRiskBadgeClass(item.ai_risk_level)}`}>
                              {item.ai_risk_level} ({item.ai_urgency_score}%)
                            </span>
                          </div>

                          {item.image_verified && item.image_quality_score > 0 && (
                            <div className="absolute top-2.5 right-2.5 shadow-sm">
                              <ImageQualityBadge verified={item.image_verified} score={item.image_quality_score} />
                            </div>
                          )}

                          {/* Bottom Banner with Quick Inspection Hint */}
                          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white text-xs">
                            <span className="font-semibold flex items-center space-x-1.5 text-[11px] text-white/95 group-hover:text-white">
                              <Maximize2 className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                              <span>Click to Inspect High-Res Photo</span>
                            </span>
                            <span className="text-[10px] bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded font-mono border border-white/20">
                              {item.food_type}
                            </span>
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-bold text-slate-900 text-sm">{item.food_title}</h3>
                          {!hasImage && (
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${getRiskBadgeClass(item.ai_risk_level)}`}>
                              {item.ai_risk_level} ({item.ai_urgency_score}%)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600">
                          Donor: <span className="font-bold text-slate-900">{item.donor?.profile?.organization_name || item.donor?.username}</span> • <span className="font-bold text-forest-800">{item.quantity}</span>
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <CountdownTimer createdAt={item.created_at} expiryHours={item.expiry_hours} />
                        {hasImage && item.image_verified && item.image_quality_score > 0 && (
                          <ImageQualityBadge verified={item.image_verified} score={item.image_quality_score} />
                        )}
                        {hasImage && (
                          <button
                            type="button"
                            onClick={() => setSelectedImageDonation(item)}
                            className="text-[11px] font-bold text-forest-700 hover:text-forest-900 hover:underline flex items-center space-x-1 ml-auto"
                          >
                            <Eye className="w-3.5 h-3.5 text-forest-600" />
                            <span>Inspect</span>
                          </button>
                        )}
                      </div>

                      <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 space-y-1">
                        <p className="font-medium text-forest-900">{item.ai_insight || `⚡ Priority pickup recommended.`}</p>
                        <p className="flex items-center space-x-1 text-slate-500 pt-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate">{item.pickup_location}</span>
                        </p>
                      </div>

                      {hasImage ? (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedImageDonation(item)}
                            className="py-2.5 px-3 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-2xs"
                          >
                            <Eye className="w-4 h-4 text-slate-500" />
                            <span>Inspect</span>
                          </button>

                          <button
                            onClick={() => handleClaim(item.id)}
                            disabled={actionLoading === item.id}
                            className="py-2.5 px-3 rounded-xl bg-forest-700 text-white font-bold hover:bg-forest-800 text-xs transition-all shadow-sm flex items-center justify-center space-x-1.5 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Claim</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleClaim(item.id)}
                          disabled={actionLoading === item.id}
                          className="w-full py-2.5 px-3 rounded-xl bg-forest-700 text-white font-bold hover:bg-forest-800 text-xs transition-all shadow-sm flex items-center justify-center space-x-2 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Claim / Accept Donation</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* High-Resolution Food Image Lightbox Modal */}
      <FoodImageLightboxModal
        donation={selectedImageDonation}
        onClose={() => setSelectedImageDonation(null)}
        onClaim={handleClaim}
        claimLoading={actionLoading === selectedImageDonation?.id}
      />
    </div>
  );
};
