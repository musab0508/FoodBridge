import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const isAuthEndpoint = config.url?.includes('/auth/register') || config.url?.includes('/auth/login');
    const token = localStorage.getItem('access_token');
    if (token && token !== 'undefined' && token !== 'null' && !isAuthEndpoint) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/auth/register');
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken && refreshToken !== 'undefined' && refreshToken !== 'null') {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
            refresh: refreshToken,
          });
          const { access } = res.data;
          localStorage.setItem('access_token', access);
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        } catch (refreshError) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authService = {
  login: async (username, password) => {
    const response = await api.post('/auth/login/', { username, password });
    return response.data;
  },
  register: async (userData) => {
    const response = await api.post('/auth/register/', userData);
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/auth/me/');
    return response.data;
  },
  getUsers: async (role = null) => {
    const response = await api.get('/users/', { params: role ? { role } : {} });
    return response.data;
  },
  getPendingNgos: async () => {
    const response = await api.get('/admin/pending-ngos/');
    return response.data;
  },
  approveNgo: async (userId) => {
    const response = await api.post(`/admin/ngos/${userId}/approve/`);
    return response.data;
  },
  rejectNgo: async (userId) => {
    const response = await api.post(`/admin/ngos/${userId}/reject/`);
    return response.data;
  },
  toggleUserActive: async (userId) => {
    const response = await api.post(`/users/${userId}/toggle-active/`);
    return response.data;
  },
};

export const donationService = {
  getDonations: async (status = null, sort = null) => {
    const params = {};
    if (status) params.status = status;
    if (sort) params.sort = sort;
    const response = await api.get('/donations/', { params });
    return response.data;
  },
  createDonation: async (donationData) => {
    let payload = donationData;
    let config = {};
    if (donationData instanceof FormData) {
      config.headers = { 'Content-Type': 'multipart/form-data' };
    } else if (donationData && donationData.image instanceof File) {
      const formData = new FormData();
      Object.keys(donationData).forEach((key) => {
        if (donationData[key] !== null && donationData[key] !== undefined) {
          formData.append(key, donationData[key]);
        }
      });
      payload = formData;
      config.headers = { 'Content-Type': 'multipart/form-data' };
    }
    const response = await api.post('/donations/', payload, config);
    return response.data;
  },
  claimDonation: async (donationId) => {
    const response = await api.post(`/donations/${donationId}/claim/`);
    return response.data;
  },
  updateDonationStatus: async (donationId, newStatus, notes = '', extraData = {}) => {
    const payload = typeof notes === 'object' 
      ? { status: newStatus, ...notes } 
      : { status: newStatus, notes, ...extraData };
    const response = await api.post(`/donations/${donationId}/update_status/`, payload);
    return response.data;
  },
  completeDelivery: async (donationId, handoffPin, notes = '') => {
    const response = await api.post(`/donations/${donationId}/update_status/`, {
      status: 'DELIVERED',
      handoff_pin: handoffPin,
      notes,
    });
    return response.data;
  },
  inspectImage: async (formData) => {
    const response = await api.post('/donations/inspect-image/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  getOptimizedRoutes: async (lat, lng, options = {}) => {
    const params = { latitude: lat, longitude: lng, ...options };
    const response = await api.get('/routes/optimize/', { params });
    return response.data;
  },
  optimizeRoute: async (volunteerLat, volunteerLng, donationIds = [], options = {}) => {
    const payload = {
      volunteer_lat: volunteerLat,
      volunteer_lng: volunteerLng,
      donation_ids: donationIds,
      ...options,
    };
    const response = await api.post('/routes/optimize/', payload);
    return response.data;
  },
  getAdminMetrics: async () => {
    const response = await api.get('/admin/metrics/');
    return response.data;
  },
  generateHandoffToken: async (donationId, action = 'PICKUP', options = {}) => {
    const response = await api.post(`/donations/${donationId}/generate-handoff-token/`, {
      action,
      ...options,
    });
    return response.data;
  },
  verifyHandoff: async (donationId, verificationData = {}) => {
    const response = await api.post(`/donations/${donationId}/verify-handoff/`, verificationData);
    return response.data;
  },
  getHandoffReceipt: async (donationId) => {
    const response = await api.get(`/donations/${donationId}/handoff-receipt/`);
    return response.data;
  },
  streamTelemetry: async (telemetryData) => {
    const response = await api.post('/donations/telemetry/stream/', telemetryData);
    return response.data;
  },
  getNotifications: async () => {
    const response = await api.get('/notifications/');
    return response.data;
  },
  markNotificationsRead: async () => {
    const response = await api.post('/notifications/');
    return response.data;
  },
};

export default api;
