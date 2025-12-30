import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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
  updateApiKey: (id, api_key) => api.put(`/admin/clients/${id}/api-key`, { api_key }),
  regenerateAccessCode: (id) => api.post(`/admin/clients/${id}/access-code`),
  getStats: (id) => api.get(`/admin/clients/${id}/stats`),
  getBusinessInfo: async (id) => {
    const response = await api.get(`/admin/clients/${id}/business-info`);
    return response.data;
  },
  updateBusinessInfo: async (id, business_info) => {
    const response = await api.put(`/admin/clients/${id}/business-info`, { business_info });
    return response.data;
  },
};

// Tool endpoints
export const tools = {
  getAll: () => api.get('/admin/tools'),
  getById: (id) => api.get(`/admin/tools/${id}`),
  create: (data) => api.post('/admin/tools', data),
  update: (id, data) => api.put(`/admin/tools/${id}`, data),
  delete: (id) => api.delete(`/admin/tools/${id}`),
  getByClient: (clientId) => api.get(`/admin/clients/${clientId}/tools`),
  enableForClient: (clientId, data) => api.post(`/admin/clients/${clientId}/tools`, data),
  updateForClient: (clientId, toolId, data) => api.put(`/admin/clients/${clientId}/tools/${toolId}`, data),
  disableForClient: (clientId, toolId) => api.delete(`/admin/clients/${clientId}/tools/${toolId}`),
  test: (toolId, params) => api.post(`/admin/tools/${toolId}/test`, params),
  testTool: (clientId, toolId, params) => api.post(`/admin/clients/${clientId}/tools/${toolId}/test`, params),
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
  toggle: (id) => api.post(`/admin/integrations/${id}/toggle`),
  test: (id) => api.post(`/admin/integrations/${id}/test`),
  // Get available integration types for tools
  getTypes: () => api.get('/admin/integrations/types'),
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

// Billing endpoints
export const billing = {
  getInvoices: (params) => api.get('/admin/billing/invoices', { params }),
  getInvoiceById: (id) => api.get(`/admin/billing/invoices/${id}`),
  getClientInvoices: (clientId, params) => api.get(`/admin/clients/${clientId}/invoices`, { params }),
  generateInvoice: (data) => api.post('/admin/billing/generate', data),
  markAsPaid: (id, data) => api.post(`/admin/billing/invoices/${id}/mark-paid`, data),
  cancelInvoice: (id, data) => api.post(`/admin/billing/invoices/${id}/cancel`, data),
  chargeInvoice: (id) => api.post(`/admin/billing/invoices/${id}/charge`),
  getRevenue: (params) => api.get('/admin/billing/revenue', { params }),
  getOutstanding: () => api.get('/admin/billing/outstanding'),
};

// Plan endpoints
export const plans = {
  getAll: (activeOnly = false) => api.get('/admin/plans', { params: { activeOnly } }),
  getById: (id) => api.get(`/admin/plans/${id}`),
  create: (data) => api.post('/admin/plans', data),
  update: (id, data) => api.put(`/admin/plans/${id}`, data),
  delete: (id) => api.delete(`/admin/plans/${id}`),
  setDefault: (id) => api.post(`/admin/plans/${id}/set-default`),
  refreshCache: () => api.post('/admin/plans/refresh-cache'),
};

// Usage endpoints
export const usage = {
  getSummary: async (clientId, period = 'month') => {
    const response = await api.get(`/admin/clients/${clientId}/usage`, { params: { period } });
    return response.data;
  },
  getHistory: async (clientId, metric = 'messages', months = 12) => {
    const response = await api.get(`/admin/clients/${clientId}/usage/history`, {
      params: { metric, months },
    });
    return response.data;
  },
  exportCSV: async (clientId, startDate, endDate) => {
    const response = await api.get(`/admin/clients/${clientId}/usage/export`, {
      params: { startDate, endDate },
    });
    return response.data;
  },
  getTopClients: async (metric = 'cost', limit = 10, period = 'month') => {
    const response = await api.get('/admin/usage/top-clients', {
      params: { metric, limit, period },
    });
    return response.data;
  },
  getAllSummary: async (period = 'month') => {
    const response = await api.get('/admin/usage/summary', { params: { period } });
    return response.data;
  },
  getAllClientsSummary: async (period = 'month') => {
    const response = await api.get('/admin/usage/summary', { params: { period } });
    return response.data;
  },
  getAllClientsHistory: async (metric = 'messages', months = 12) => {
    const response = await api.get('/admin/usage/history', {
      params: { metric, months },
    });
    return response.data;
  },
};

// Escalation endpoints
export const escalations = {
  getAll: (params) => api.get('/admin/escalations', { params }),
  getById: (id) => api.get(`/admin/escalations/${id}`),
  updateStatus: (id, status, notes, assigned_to) =>
    api.put(`/admin/escalations/${id}/status`, { status, notes, assigned_to }),
  resolve: (id, notes) => api.post(`/admin/escalations/${id}/resolve`, { notes }),
  cancel: (id) => api.post(`/admin/escalations/${id}/cancel`),
  getGlobalStats: () => api.get('/admin/escalations/stats/global'),
  getClientStats: (clientId) => api.get(`/admin/clients/${clientId}/escalations/stats`),
};

// Email channel endpoints
export const email = {
  // Get OAuth URL to initiate Gmail connection
  getAuthUrl: (clientId) => api.get(`/email/oauth/authorize/${clientId}`),
  // Get all email channels for a client
  getChannels: (clientId) => api.get(`/email/channels/${clientId}`),
  // Get a specific email channel
  getChannel: (channelId) => api.get(`/email/channel/${channelId}`),
  // Update email channel settings
  updateChannel: (channelId, settings) => api.put(`/email/channel/${channelId}`, { settings }),
  // Disconnect/delete an email channel
  disconnectChannel: (channelId) => api.delete(`/email/channel/${channelId}`),
  // Test connection to Gmail
  testConnection: (channelId) => api.post(`/email/channel/${channelId}/test`),
  // Send a test email
  sendTestEmail: (channelId, data) => api.post(`/email/channel/${channelId}/send-test`, data),
  // Get unread emails (for debugging)
  getUnreadEmails: (channelId, limit = 10) => api.get(`/email/channel/${channelId}/unread`, { params: { limit } }),
  // Get email statistics
  getStats: () => api.get('/email/stats'),
};

export default api;
