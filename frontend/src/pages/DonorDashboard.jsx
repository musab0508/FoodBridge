import React, { useState, useEffect } from 'react';
import { donationService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PlusCircle, Utensils, Clock, MapPin, CheckCircle2, ShieldAlert, AlertTriangle, Sparkles, PackageCheck } from 'lucide-react';

export const DonorDashboard = () => {
  const { user } = useAuth();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [expiryError, setExpiryError] = useState('');

  const [form, setForm] = useState({
    food_title: '',
    food_type: 'COOKED',
    quantity_amount: 10,
    quantity_unit: 'meals',
    pickup_location: user?.profile?.address || '',
    expiry_hours: 8,
  });

  const fetchDonations = async () => {
    try {
      setLoading(true);
      const data = await donationService.getDonations();
      setDonations(data);
    } catch (err) {
      console.error('Failed to fetch donations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonations();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (name === 'expiry_hours') {
      if (parseInt(value, 10) < 1) {
        setExpiryError('Expiry time must be at least 1 hour in the future.');
      } else {
        setExpiryError('');
      }
    }
  };

  const isFormValid = () => {
    if (!form.food_title || !form.pickup_location) return false;
    if (parseInt(form.quantity_amount, 10) < 1) return false;
    if (parseInt(form.expiry_hours, 10) < 1) return false;
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid()) return;

    setSubmitting(true);
    setMessage('');

    try {
      await donationService.createDonation(form);
      setMessage('Surplus food donation listed with live AI Safety Score!');
      setForm({
        food_title: '',
        food_type: 'COOKED',
        quantity_amount: 10,
        quantity_unit: 'meals',
        pickup_location: user?.profile?.address || '',
        expiry_hours: 8,
      });
      fetchDonations();
    } catch (err) {
      setMessage('Failed to create donation. Verify input values.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeDonations = donations.filter((d) => d.status !== 'DELIVERED' && d.status !== 'EXPIRED');
  const historicalDonations = donations.filter((d) => d.status === 'DELIVERED' || d.status === 'EXPIRED');

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
      {/* Organic Header Banner */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-forest-700">Food Donor Portal</span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
            {user?.profile?.organization_name || user?.username}
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Post surplus meals, evaluate AI safety decay scores, and track volunteer pickups.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs text-slate-700 bg-warm-100 px-3.5 py-2 rounded-xl border border-slate-200">
          <MapPin className="w-4 h-4 text-forest-700" />
          <span>{user?.profile?.address || 'Registered Donor Location'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Post Food Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="organic-card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="flex items-center space-x-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-forest-50 flex items-center justify-center border border-forest-200 text-forest-700">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Post Surplus Food</h2>
                <p className="text-[11px] text-slate-500">List available items for NGO rescue</p>
              </div>
            </div>

            {message && (
              <div className="p-3 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{message}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Food Item Title *</label>
                <input
                  type="text"
                  name="food_title"
                  required
                  value={form.food_title}
                  onChange={handleChange}
                  placeholder="e.g. 50 Trays Fresh Baked Bread"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 text-xs focus:outline-none focus:border-forest-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Food Category</label>
                <select
                  name="food_type"
                  value={form.food_type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 text-xs focus:outline-none focus:border-forest-600"
                >
                  <option value="COOKED">Cooked Meal (Fast Decay)</option>
                  <option value="PERISHABLE">Perishable Produce / Dairy</option>
                  <option value="NON_PERISHABLE">Non-Perishable Packaged</option>
                  <option value="RAW">Raw Ingredients</option>
                </select>
              </div>

              {/* Quantity Split into Amount + Unit Selector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Amount (Numeric) *</label>
                  <input
                    type="number"
                    min="1"
                    name="quantity_amount"
                    required
                    value={form.quantity_amount}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 text-xs focus:outline-none focus:border-forest-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Unit *</label>
                  <select
                    name="quantity_unit"
                    value={form.quantity_unit}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 text-xs focus:outline-none focus:border-forest-600"
                  >
                    <option value="meals">meals</option>
                    <option value="kg">kg</option>
                    <option value="packets">packets</option>
                    <option value="liters">liters</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Expiry Window (Hours) *</label>
                <input
                  type="number"
                  min="1"
                  name="expiry_hours"
                  required
                  value={form.expiry_hours}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 text-xs focus:outline-none focus:border-forest-600"
                />
                {expiryError && <p className="text-[10px] text-rose-600 font-semibold mt-1">{expiryError}</p>}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Pickup Address *</label>
                <textarea
                  name="pickup_location"
                  required
                  rows={2}
                  value={form.pickup_location}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 text-xs focus:outline-none focus:border-forest-600"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !isFormValid()}
                className="w-full py-3 px-4 rounded-xl font-bold bg-forest-700 text-white hover:bg-forest-800 transition-all shadow-sm text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Calculating AI Score & Publishing...' : 'Publish Surplus Food Listing'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Columns: Active & Historical Listings with AI Insights */}
        <div className="lg:col-span-2 space-y-6">
          <div className="organic-card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Utensils className="w-5 h-5 text-forest-700" />
                <span>Active Food Listings ({activeDonations.length})</span>
              </h2>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-500">Loading food listings...</div>
            ) : activeDonations.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
                <p className="text-xs font-semibold text-slate-500">No active surplus food listed.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeDonations.map((item) => (
                  <div key={item.id} className="p-4 rounded-xl bg-warm-50 border border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-bold text-slate-900 text-sm">{item.food_title}</h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${getRiskBadgeClass(item.ai_risk_level)}`}>
                            {item.ai_risk_level} ({item.ai_urgency_score}%)
                          </span>
                        </div>
                        <div className="flex items-center space-x-3 text-xs text-slate-600">
                          <span className="font-bold text-forest-800">{item.quantity}</span>
                          <span>•</span>
                          <span>Category: {item.food_type}</span>
                          <span>•</span>
                          <span>Available: {item.expiry_hours}h</span>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs">
                        {item.status}
                      </span>
                    </div>

                    {/* AI Safety Insight Badge */}
                    <div className="p-2.5 rounded-lg bg-forest-50 border border-forest-200 text-xs font-medium text-forest-900 flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-forest-700 flex-shrink-0" />
                      <span>{item.ai_insight || `⚡ AI Urgency Score: ${item.ai_urgency_score}%`}</span>
                    </div>

                    <div className="pt-2 text-xs text-slate-500 flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.pickup_location}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historical Log */}
          <div className="organic-card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2 mb-4">
              <PackageCheck className="w-5 h-5 text-emerald-700" />
              <span>Completed Distribution Logs ({historicalDonations.length})</span>
            </h2>

            {historicalDonations.length === 0 ? (
              <p className="text-xs text-slate-500">No completed distributions recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {historicalDonations.map((item) => (
                  <div key={item.id} className="p-3 rounded-xl bg-warm-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{item.food_title}</p>
                      <p className="text-slate-500">{item.quantity} • Rescued by {item.claimed_by?.profile?.organization_name || 'NGO'}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {item.status}
                    </span>
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
