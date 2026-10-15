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
    const token = localStorage.getItem('access_token');
    if (token) {
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
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
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
    const response = await api.post('/donations/', donationData);
    return response.data;
  },
  claimDonation: async (donationId) => {
    const response = await api.post(`/donations/${donationId}/claim/`);
    return response.data;
  },
  updateDonationStatus: async (donationId, newStatus, notes = '') => {
    const response = await api.post(`/donations/${donationId}/update_status/`, {
      status: newStatus,
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
  optimizeRoute: async (volunteerLat, volunteerLng, donationIds = []) => {
    const response = await api.post('/donations/optimize-route/', {
      volunteer_lat: volunteerLat,
      volunteer_lng: volunteerLng,
      donation_ids: donationIds,
    });
    return response.data;
  },
  getAdminMetrics: async () => {
    const response = await api.get('/admin/metrics/');
    return response.data;
  },
};

export default api;
