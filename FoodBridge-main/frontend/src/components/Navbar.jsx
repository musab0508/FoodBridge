import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Utensils, LogOut, ShieldCheck, HeartHandshake, Store, Clock } from 'lucide-react';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    if (user.role === 'ADMIN' || user.is_superuser) return '/dashboard/admin';
    if (user.role === 'NGO') return '/dashboard/ngo';
    return '/dashboard/donor';
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to={getDashboardPath()} className="flex items-center space-x-3 group">
          <div className="w-9 h-9 rounded-xl bg-forest-700 text-white flex items-center justify-center shadow-md shadow-forest-900/10 group-hover:scale-105 transition-transform">
            <Utensils className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-forest-900">
              FoodBridge
            </span>
            <span className="hidden sm:inline-block ml-2.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-forest-50 text-forest-700 border border-forest-200">
              Community Food Rescue
            </span>
          </div>
        </Link>

        {/* User Navigation / Role Badges */}
        {user ? (
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2.5 px-3 py-1.5 rounded-lg bg-warm-100 border border-slate-200">
              {user.role === 'ADMIN' && <ShieldCheck className="w-4 h-4 text-purple-600" />}
              {user.role === 'NGO' && <HeartHandshake className="w-4 h-4 text-emerald-600" />}
              {user.role === 'DONOR' && <Store className="w-4 h-4 text-forest-600" />}
              <div className="text-xs">
                <span className="font-bold text-slate-800">
                  {user.profile?.organization_name || user.username}
                </span>
                <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-white text-forest-700 border border-slate-200">
                  {user.role}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-all"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              <span>Logout</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            <Link
              to="/login"
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-3 py-2 rounded-lg transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="text-xs font-bold px-4 py-2 rounded-lg bg-forest-700 text-white hover:bg-forest-800 transition-all shadow-sm"
            >
              Register Account
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
};
