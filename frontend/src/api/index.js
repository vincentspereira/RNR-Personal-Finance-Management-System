import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// Attach auth token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pfms_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Dispatch a custom event on 401 so the auth hook can react (no hard redirect).
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pfms_token');
      localStorage.removeItem('pfms_refresh_token');
      window.dispatchEvent(new CustomEvent('pfms:auth:unauthorized'));
    }
    const message = err.response?.data?.error || err.message || 'Network error';
    const wrapped = new Error(message);
    wrapped.status = err.response?.status;
    wrapped.details = err.response?.data?.meta?.details;
    return Promise.reject(wrapped);
  }
);

// Auth
export const authApi = {
  register: (email, password, name) => api.post('/auth/register', { email, password, name }),
  login: (email, password) => api.post('/auth/login', { email, password }),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  logout: (refreshToken) => api.post('/auth/logout', { refreshToken }),
  profile: (token) => api.get('/auth/profile', token ? { headers: { Authorization: `Bearer ${token}` } } : undefined),
  changePassword: (oldPassword, newPassword) => api.post('/auth/change-password', { oldPassword, newPassword }),
};

// Transactions
export const transactionsApi = {
  list: (params) => api.get('/transactions', { params }),
  get: (id) => api.get(`/transactions/${id}`),
  create: (data) => api.post('/transactions', data),
  update: (id, data) => api.put(`/transactions/${id}`, data),
  delete: (id) => api.delete(`/transactions/${id}`),
  bulkCreate: (transactions) => api.post('/transactions/bulk', { transactions }),
  export: (params) => api.get('/transactions/export', { params, responseType: params?.format === 'csv' ? 'blob' : 'json' }),
  importPreview: (file) => {
    const formData = new FormData();
    formData.append('files', file);
    return api.post('/transactions/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importConfirm: (data) => api.post('/transactions/import/confirm', data),

  // Transfers (paired, atomic)
  createTransfer: (data) => api.post('/transactions/transfers', data),
  deleteTransfer: (groupId) => api.delete(`/transactions/transfers/${groupId}`),

  // Splits (one parent, many child line items)
  createSplit: (data) => api.post('/transactions/splits', data),
  getSplit: (id) => api.get(`/transactions/splits/${id}`),
  deleteSplit: (id) => api.delete(`/transactions/splits/${id}`),
};

// Accounts
export const accountsApi = {
  list: () => api.get('/accounts'),
  create: (data) => api.post('/accounts', data),
  update: (id, data) => api.put(`/accounts/${id}`, data),
  archive: (id) => api.delete(`/accounts/${id}`),
  balance: (id, params) => api.get(`/accounts/${id}/balance`, { params }),
};

// Categories
export const categoriesApi = {
  list: () => api.get('/categories'),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id, reassignTo) => api.delete(`/categories/${id}`, { params: { reassignTo } }),
};

// Scans
export const scansApi = {
  upload: (files) => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    return api.post('/scans/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
  },
  status: (id) => api.get(`/scans/${id}/status`),
  results: (id) => api.get(`/scans/${id}/results`),
  confirm: (id, documents) => api.post(`/scans/${id}/confirm`, { documents }),
  retry: (id) => api.post(`/scans/${id}/retry`),
  list: (params) => api.get('/scans', { params }),
};

// Analytics
export const analyticsApi = {
  summary: (params) => api.get('/analytics/summary', { params }),
  byCategory: (params) => api.get('/analytics/by-category', { params }),
  trends: (params) => api.get('/analytics/trends', { params }),
  topMerchants: (params) => api.get('/analytics/top-merchants', { params }),
  cashflow: (params) => api.get('/analytics/cashflow', { params }),
  cashflowForecast: (params) => api.get('/analytics/cashflow-forecast', { params }),
  budgetVsActual: (params) => api.get('/analytics/budget-vs-actual', { params }),
  recurring: () => api.get('/analytics/recurring'),
  netWorth: () => api.get('/analytics/net-worth'),
  netWorthHistory: (params) => api.get('/analytics/net-worth-history', { params }),
  budgetAlerts: () => api.get('/analytics/budget-alerts'),
};

// Reports
export const reportsApi = {
  monthly: (params) => api.get('/reports/monthly', { params }),
  annual: (params) => api.get('/reports/annual', { params }),
  custom: (data) => api.post('/reports/custom', data),
  netWorth: () => api.get('/reports/net-worth'),
};

// Budgets
export const budgetsApi = {
  list: () => api.get('/budgets'),
  create: (data) => api.post('/budgets', data),
  update: (id, data) => api.put(`/budgets/${id}`, data),
  delete: (id) => api.delete(`/budgets/${id}`),
};

// Recurring patterns
export const recurringApi = {
  list: () => api.get('/recurring'),
  upcoming: (days) => api.get('/recurring/upcoming', { params: { days } }),
  refresh: () => api.post('/recurring/refresh'),
  toggle: (id, active) => api.put(`/recurring/${id}/toggle`, { active }),
};

// Savings goals
export const savingsGoalsApi = {
  list: () => api.get('/savings-goals'),
  create: (data) => api.post('/savings-goals', data),
  update: (id, data) => api.put(`/savings-goals/${id}`, data),
  delete: (id) => api.delete(`/savings-goals/${id}`),
};

// Currency
export const currencyApi = {
  rates: (base) => api.get('/currency/rates', { params: { base } }),
  convert: (amount, from, to) => api.post('/currency/convert', { amount, from, to }),
  list: () => api.get('/currency/list'),
};

// Notifications
export const notificationsApi = {
  list: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
};

// Export
export const exportApi = {
  transactionsCSV: (params) => {
    const query = new URLSearchParams(params || {}).toString();
    return fetch(`/api/export/transactions${query ? '?' + query : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('pfms_token')}` },
    }).then(res => res.blob());
  },
  reportCSV: (params) => {
    const query = new URLSearchParams(params || {}).toString();
    return fetch(`/api/export/report${query ? '?' + query : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('pfms_token')}` },
    }).then(res => res.blob());
  },
};

export default api;
