import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '') + '/api/customer';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('customerToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('customerToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const auth = {
  login: (accessCode, rememberMe = false) => api.post('/auth/login', { accessCode, rememberMe }),
};

// Dashboard endpoints
export const dashboard = {
  getOverview: () => api.get('/dashboard/overview'),
};

// Actions (tools) endpoints
export const actions = {
  getAll: () => api.get('/actions'),
};

// Conversations endpoints
export const conversations = {
  getAll: (params) => api.get('/conversations', { params }),
  getById: (id) => api.get(`/conversations/${id}`),
};

// Billing endpoints
export const billing = {
  getInvoices: () => api.get('/billing/invoices'),
};

// Usage endpoints
export const usage = {
  getCurrent: (params = {}) => api.get('/usage/current', { params }),
  getTrends: (params) => api.get('/usage/trends', { params }),
  getTools: () => api.get('/usage/tools'),
};

// Settings endpoints
export const settings = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};

// AI Behavior endpoints
export const aiBehavior = {
  get: () => api.get('/ai-behavior'),
  update: (data) => api.put('/ai-behavior', data),
  preview: (config) => api.post('/ai-behavior/preview', { config }),
  reset: () => api.delete('/ai-behavior'),
};

// Escalations endpoints
export const escalations = {
  getAll: (params) => api.get('/escalations', { params }),
  getById: (id) => api.get(`/escalations/${id}`),
  getStats: () => api.get('/escalations/stats'),
  acknowledge: (id) => api.post(`/escalations/${id}/acknowledge`),
  resolve: (id, notes) => api.post(`/escalations/${id}/resolve`, { notes }),
  cancel: (id, notes) => api.post(`/escalations/${id}/cancel`, { notes }),
};

export default api;
