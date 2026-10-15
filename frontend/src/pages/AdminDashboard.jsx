import React, { useState, useEffect } from 'react';
import { donationService, authService } from '../services/api';
import { ShieldCheck, Users, Utensils, CheckCircle2, XCircle, AlertTriangle, Activity, Sparkles, Clock, ShieldAlert } from 'lucide-react';

export const AdminDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [pendingNgos, setPendingNgos] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [donationsList, setDonationsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [m, pending, users, donations] = await Promise.all([
        donationService.getAdminMetrics(),
        authService.getPendingNgos(),
        authService.getUsers(),
        donationService.getDonations(),
      ]);
      setMetrics(m.metrics);
      setPendingNgos(pending);
      setUsersList(users);
      setDonationsList(donations);
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleApproveNgo = async (userId) => {
    setActionLoading(userId);
    try {
      await authService.approveNgo(userId);
      await fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to approve NGO.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectNgo = async (userId) => {
    if (!window.confirm('Are you sure you want to reject and remove this NGO application?')) return;
    setActionLoading(userId);
    try {
      await authService.rejectNgo(userId);
      await fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reject NGO.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = async (userId) => {
    setActionLoading(userId);
    try {
      await authService.toggleUserActive(userId);
      await fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update user status.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Admin Header */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">System Administration & Verification Command</span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1">Platform Control Center</h1>
          <p className="text-xs text-slate-600 mt-1">
            Review pending NGO verification requests, audit food rescue operations, and monitor AI urgency analytics.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs font-semibold text-purple-900 bg-purple-50 px-3.5 py-2 rounded-xl border border-purple-200">
          <ShieldCheck className="w-4 h-4 text-purple-700" />
          <span>Full Privileges Active</span>
        </div>
      </div>

      {/* Counter Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Pending NGO Verifications</span>
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900">{metrics.pending_ngos}</p>
            <p className="text-[11px] text-amber-700 font-bold">Action Required in Hub</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Total Food Listings</span>
              <Utensils className="w-5 h-5 text-forest-700" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900">{metrics.total_donations}</p>
            <p className="text-[11px] text-forest-700 font-bold">{metrics.available_count} Available Now</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Completed Rescues</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900">{metrics.completed_distributions}</p>
            <p className="text-[11px] text-slate-600 font-medium">{metrics.active_donations} Active Operations</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Verified NGO & Donors</span>
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900">{metrics.total_ngos + metrics.total_donors}</p>
            <p className="text-[11px] text-slate-600">{metrics.total_ngos} NGOs • {metrics.total_donors} Donors</p>
          </div>
        </div>
      )}

      {/* AI Analytics Card: Food Rescued vs. Expiry Risk Avoided */}
      {metrics?.ai_analytics && (
        <div className="organic-card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-forest-700" />
            <h2 className="text-base font-bold text-slate-900">AI Analytics: Food Rescued vs. Expiry Risk Avoided</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-forest-50 border border-forest-200 text-center">
              <p className="text-xs text-forest-800 font-bold uppercase">Avg AI Urgency Index</p>
              <p className="text-2xl font-extrabold text-forest-900 mt-1">{metrics.ai_analytics.avg_urgency_score}%</p>
            </div>
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-center">
              <p className="text-xs text-rose-800 font-bold uppercase">Critical Spoilage Avoided</p>
              <p className="text-2xl font-extrabold text-rose-900 mt-1">{metrics.ai_analytics.critical_rescued} Items</p>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <p className="text-xs text-amber-800 font-bold uppercase">High Urgency Rescued</p>
              <p className="text-2xl font-extrabold text-amber-900 mt-1">{metrics.ai_analytics.high_rescued} Items</p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
              <p className="text-xs text-emerald-800 font-bold uppercase">Risk Avoidance Efficiency</p>
              <p className="text-2xl font-extrabold text-emerald-900 mt-1">{metrics.ai_analytics.risk_avoided_percentage}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Section: Pending NGO Verification Hub */}
      <div className="organic-card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <span>Pending NGO Verification Hub ({pendingNgos.length})</span>
          </h2>
          <span className="text-xs text-slate-500 font-medium">Approval enables immediate NGO platform login</span>
        </div>

        {pendingNgos.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl bg-warm-50">
            <p className="text-xs font-semibold text-slate-600">No pending NGO registration applications.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-warm-100 text-slate-700 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">NGO Organization</th>
                  <th className="px-4 py-3">Registration / Govt ID</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Submitted Date</th>
                  <th className="px-4 py-3 text-right">Approval Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pendingNgos.map((ngo) => (
                  <tr key={ngo.id} className="hover:bg-warm-50">
                    <td className="px-4 py-3.5 font-bold text-slate-900">
                      <div>{ngo.profile?.organization_name || ngo.username}</div>
                      <div className="text-[11px] text-slate-500 font-normal">@{ngo.username} • {ngo.email}</div>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-800">
                      {ngo.profile?.registration_number || 'N/A'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {ngo.profile?.phone_number || 'N/A'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {new Date(ngo.profile?.created_at || Date.now()).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => handleApproveNgo(ngo.id)}
                        disabled={actionLoading === ngo.id}
                        className="px-3 py-1.5 rounded-lg bg-forest-700 text-white font-bold hover:bg-forest-800 text-[11px] shadow-sm transition-all inline-flex items-center space-x-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleRejectNgo(ngo.id)}
                        disabled={actionLoading === ngo.id}
                        className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-300 font-bold hover:bg-rose-100 text-[11px] transition-all inline-flex items-center space-x-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Management & Role Audit */}
      <div className="organic-card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
          <Users className="w-5 h-5 text-forest-700" />
          <span>User Accounts Audit ({usersList.length})</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-warm-100 text-slate-700 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">User / Organization</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Contact Details</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Account Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {usersList.map((u) => (
                <tr key={u.id} className="hover:bg-warm-50">
                  <td className="px-4 py-3 font-bold text-slate-900">
                    <div>{u.profile?.organization_name || u.username}</div>
                    <div className="text-[11px] text-slate-500 font-normal">@{u.username} • {u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                      u.role === 'NGO' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                      'bg-forest-50 text-forest-800 border border-forest-300'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div>{u.profile?.phone_number || 'N/A'}</div>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active ? (
                      <span className="text-emerald-700 font-bold flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="text-rose-600 font-bold flex items-center space-x-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Deactivated</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleToggleActive(u.id)}
                      disabled={actionLoading === u.id || u.is_superuser}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        u.is_active
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                      } disabled:opacity-30`}
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
