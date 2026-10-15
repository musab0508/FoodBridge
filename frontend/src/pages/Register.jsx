import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Utensils, Store, HeartHandshake, ShieldCheck, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

export const Register = () => {
  const [role, setRole] = useState('DONOR');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    organization_name: '',
    registration_number: '',
    phone_number: '',
    address: '',
  });

  const [phoneError, setPhoneError] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const validatePhone = (phone) => {
    const cleaned = phone.replace(/[\s\-\+\(\)]/g, '');
    const indianRegex = /^[6-9]\d{9}$/;
    if (!phone) {
      setPhoneError('Phone number is required.');
      return false;
    }
    if (!indianRegex.test(cleaned)) {
      setPhoneError('Enter a valid 10-digit mobile number starting with 6-9 (e.g. 9876543210).');
      return false;
    }
    setPhoneError('');
    return true;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (name === 'phone_number') {
      validatePhone(value);
    }
  };

  const isFormValid = () => {
    if (!formData.username || !formData.email || !formData.password || !formData.organization_name) return false;
    if (formData.password.length < 6) return false;
    if (role === 'NGO' && !formData.registration_number) return false;
    const cleanedPhone = formData.phone_number.replace(/[\s\-\+\(\)]/g, '');
    return /^[6-9]\d{9}$/.test(cleanedPhone);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!validatePhone(formData.phone_number)) {
      return;
    }

    setLoading(true);

    try {
      const payload = { ...formData, role };
      const res = await register(payload);

      if (role === 'NGO') {
        setSuccessMsg('Your NGO registration has been submitted successfully! Access is pending Administrator review.');
      } else {
        navigate(res.role === 'ADMIN' ? '/dashboard/admin' : '/dashboard/donor');
      }
    } catch (err) {
      const errorMsg = err.response?.data
        ? typeof err.response.data === 'object'
          ? Object.values(err.response.data).flat().join(' ')
          : err.response.data
        : 'Registration failed. Please check form details.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-warm-100">
      <div className="max-w-lg w-full space-y-6 organic-card p-8 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-forest-700 text-white flex items-center justify-center shadow-md mb-3">
            <Utensils className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Join FoodBridge Platform</h2>
          <p className="mt-1 text-xs text-slate-600">
            Select your account type to register your organization
          </p>
        </div>

        {/* Account Role Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => { setRole('DONOR'); setError(''); setSuccessMsg(''); }}
            className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              role === 'DONOR'
                ? 'bg-forest-700 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Food Donor</span>
          </button>

          <button
            type="button"
            onClick={() => { setRole('NGO'); setError(''); setSuccessMsg(''); }}
            className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              role === 'NGO'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <HeartHandshake className="w-4 h-4" />
            <span>NGO / Shelter</span>
          </button>
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start space-x-3 text-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-emerald-900">Registration Submitted</p>
              <p className="text-emerald-800 mt-0.5">{successMsg}</p>
              <Link to="/login" className="inline-block mt-2 font-bold text-emerald-950 underline">Go to Sign In</Link>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-xs">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <p className="text-rose-800 font-medium">{error}</p>
          </div>
        )}

        {!successMsg && (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Username *</label>
                <input
                  type="text"
                  name="username"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 text-xs focus:outline-none focus:border-forest-600"
                  placeholder="username"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Email *</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 text-xs focus:outline-none focus:border-forest-600"
                  placeholder="org@domain.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Password *</label>
              <input
                type="password"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 text-xs focus:outline-none focus:border-forest-600"
                placeholder="Minimum 6 characters"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-forest-800 uppercase mb-1">
                {role === 'NGO' ? 'NGO / Shelter Name *' : 'Restaurant / Donor Name *'}
              </label>
              <input
                type="text"
                name="organization_name"
                required
                value={formData.organization_name}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 text-xs focus:outline-none focus:border-forest-600"
                placeholder={role === 'NGO' ? 'Hope Relief Foundation' : 'Green Bistro Restaurant'}
              />
            </div>

            {role === 'NGO' && (
              <div>
                <label className="block text-[11px] font-bold text-emerald-800 uppercase mb-1">
                  NGO Registration / Govt ID Number *
                </label>
                <input
                  type="text"
                  name="registration_number"
                  required
                  value={formData.registration_number}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 text-xs focus:outline-none focus:border-emerald-600"
                  placeholder="NGO-9824-IN"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Phone Number (10-Digit Mobile) *</label>
              <input
                type="text"
                name="phone_number"
                required
                value={formData.phone_number}
                onChange={handleChange}
                className={`w-full px-3 py-2 rounded-xl bg-slate-50 border ${
                  phoneError ? 'border-rose-500 bg-rose-50/50' : 'border-slate-300'
                } text-slate-800 text-xs focus:outline-none focus:border-forest-600`}
                placeholder="9876543210"
              />
              {phoneError && <p className="text-[10px] text-rose-600 mt-1 font-semibold">{phoneError}</p>}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Address / Location</label>
              <textarea
                name="address"
                rows={2}
                value={formData.address}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 text-xs focus:outline-none focus:border-forest-600"
                placeholder="Operational address for food pickups"
              />
            </div>

            {role === 'NGO' && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start space-x-2 text-[11px] text-amber-800">
                <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>Note: NGO accounts require Administrator verification before sign-in is granted.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !isFormValid()}
              className="w-full py-3 px-4 rounded-xl font-bold bg-forest-700 text-white hover:bg-forest-800 transition-all shadow-sm text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : `Register as ${role === 'NGO' ? 'NGO' : 'Food Donor'}`}
            </button>
          </form>
        )}

        <div className="pt-3 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-600">
            Already registered?{' '}
            <Link to="/login" className="font-bold text-forest-700 hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
