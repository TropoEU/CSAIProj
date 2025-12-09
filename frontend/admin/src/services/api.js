import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
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
      localStorage.removeItem('adminToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const auth = {
  login: (username, password) => api.post('/admin/login', { username, password }),
  verify: () => api.get('/admin/verify'),
  logout: () => api.post('/admin/logout'),
};

// Client endpoints
export const clients = {
  getAll: (params) => api.get('/admin/clients', { params }),
  getById: (id) => api.get(`/admin/clients/${id}`),
  create: (data) => api.post('/admin/clients', data),
  update: (id, data) => api.put(`/admin/clients/${id}`, data),
  delete: (id) => api.delete(`/admin/clients/${id}`),
  regenerateApiKey: (id) => api.post(`/admin/clients/${id}/api-key`),
  getStats: (id) => api.get(`/admin/clients/${id}/stats`),
};

// Tool endpoints
export const tools = {
  getAll: () => api.get('/admin/tools'),
  getByClient: (clientId) => api.get(`/admin/clients/${clientId}/tools`),
  enableForClient: (clientId, data) => api.post(`/admin/clients/${clientId}/tools`, data),
  updateForClient: (clientId, toolId, data) => api.put(`/admin/clients/${clientId}/tools/${toolId}`, data),
  disableForClient: (clientId, toolId) => api.delete(`/admin/clients/${clientId}/tools/${toolId}`),
  test: (toolId, params) => api.post(`/admin/tools/${toolId}/test`, params),
};

// Conversation endpoints
export const conversations = {
  getAll: (params) => api.get('/admin/conversations', { params }),
  getById: (id) => api.get(`/admin/conversations/${id}`),
  export: (params) => api.get('/admin/conversations/export', { params, responseType: 'blob' }),
  getStats: () => api.get('/admin/stats/conversations'),
};

// Integration endpoints
export const integrations = {
  getByClient: (clientId) => api.get(`/admin/clients/${clientId}/integrations`),
  create: (clientId, data) => api.post(`/admin/clients/${clientId}/integrations`, data),
  update: (id, data) => api.put(`/admin/integrations/${id}`, data),
  delete: (id) => api.delete(`/admin/integrations/${id}`),
  test: (id) => api.post(`/admin/integrations/${id}/test`),
};

// Analytics endpoints
export const analytics = {
  getOverview: () => api.get('/admin/stats/overview'),
  getUsage: (clientId, params) => api.get(`/admin/stats/usage/${clientId}`, { params }),
  getToolStats: () => api.get('/admin/stats/tools'),
};

// Chat test endpoint
export const testChat = {
  sendMessage: (clientId, message, sessionId) =>
    api.post('/admin/test-chat', { clientId, message, sessionId }),
};

export default api;
