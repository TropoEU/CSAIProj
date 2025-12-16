import axios from 'axios';

const API_BASE_URL = '/api/customer';

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
  getCurrent: () => api.get('/usage/current'),
  getTrends: (params) => api.get('/usage/trends', { params }),
  getTools: () => api.get('/usage/tools'),
};

// Settings endpoints
export const settings = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};

export default api;
