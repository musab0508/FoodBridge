import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Utensils, Lock, User, AlertCircle, ArrowRight, Clock } from 'lucide-react';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(username, password);
      if (user.role === 'ADMIN' || user.is_superuser) {
        navigate('/dashboard/admin');
      } else if (user.role === 'NGO') {
        navigate('/dashboard/ngo');
      } else {
        navigate('/dashboard/donor');
      }
    } catch (err) {
      const detailMsg = err.response?.data?.detail || err.response?.data?.error || 'Invalid credentials or unapproved account status.';
      setError(detailMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-warm-100">
      <div className="max-w-md w-full space-y-8 organic-card p-8 rounded-2xl bg-white shadow-sm border border-slate-200">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-forest-700 text-white flex items-center justify-center shadow-md mb-4">
            <Utensils className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sign In to FoodBridge</h2>
          <p className="mt-1.5 text-xs text-slate-600">
            Access your Donor, NGO, or System Admin operational portal
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-800">Account Notification</p>
              <p className="text-xs text-amber-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Username</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 text-xs focus:outline-none focus:border-forest-600 focus:bg-white transition-all"
                  placeholder="Enter your username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 text-xs focus:outline-none focus:border-forest-600 focus:bg-white transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-bold bg-forest-700 text-white hover:bg-forest-800 transition-all shadow-sm flex items-center justify-center space-x-2 text-xs disabled:opacity-50"
          >
            {loading ? (
              <span>Verifying account...</span>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-600">
            Don't have an account?{' '}
            <Link to="/register" className="font-bold text-forest-700 hover:underline">
              Register as Donor or NGO
            </Link>
          </p>
        </div>

        {/* Quick Demo Accounts Info Box */}
        <div className="p-4 rounded-xl bg-warm-100 border border-slate-200 space-y-2">
          <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Default Test Accounts:</p>
          <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-600">
            <div className="p-2 rounded bg-white border border-slate-200">
              <span className="font-bold text-forest-700">Donor:</span><br />
              restaurant_donor / donor123
            </div>
            <div className="p-2 rounded bg-white border border-slate-200">
              <span className="font-bold text-emerald-700">Approved NGO:</span><br />
              hope_shelter_ngo / ngo123
            </div>
            <div className="p-2 rounded bg-white border border-slate-200">
              <span className="font-bold text-purple-700">Admin:</span><br />
              admin / admin123
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
