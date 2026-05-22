import { apiClient } from './client.js';

export const billingApi = {
  getInvoices: (params = {}) =>
    apiClient.get('/invoices', { params }).then((r) => r.data.data),

  getPayments: (params = {}) =>
    apiClient.get('/payments', { params }).then((r) => r.data.data),

  recordPayment: (invoiceId, data) =>
    apiClient.put(`/invoices/${invoiceId}/payment`, data).then((r) => r.data.data),

  generatePaymentLink: (invoiceId) =>
    apiClient.post(`/invoices/${invoiceId}/payment-link`).then((r) => r.data.data),

  waiveInvoice: (invoiceId, reason) =>
    apiClient.post(`/invoices/${invoiceId}/waive`, { reason }).then((r) => r.data.data),
};

export const doctorsApi = {
  getList: () =>
    apiClient.get('/doctors').then((r) => r.data.data),

  getById: (id) =>
    apiClient.get(`/doctors/${id}`).then((r) => r.data.data),

  create: (data) =>
    apiClient.post('/doctors', data).then((r) => r.data.data),

  update: (id, data) =>
    apiClient.patch(`/doctors/${id}`, data).then((r) => r.data.data),

  getPatients: (id) =>
    apiClient.get(`/doctors/${id}/patients`).then((r) => r.data.data),

  getCommissions: (id) =>
    apiClient.get(`/doctors/${id}/commissions`).then((r) => r.data.data),

  payCommission: (id, data) =>
    apiClient.post(`/doctors/${id}/commissions/pay`, data).then((r) => r.data.data),

  sendStatement: (id) =>
    apiClient.post(`/doctors/${id}/commissions/statement`).then((r) => r.data.data),

  // Portal endpoints
  getPortalPatients: () =>
    apiClient.get('/doctors/portal/patients').then((r) => r.data.data),

  getPortalCommissions: () =>
    apiClient.get('/doctors/portal/commissions').then((r) => r.data.data),
};

export const staffApi = {
  getList: () =>
    apiClient.get('/staff').then((r) => r.data.data),

  create: (data) =>
    apiClient.post('/staff', data).then((r) => r.data.data),

  update: (id, data) =>
    apiClient.patch(`/staff/${id}`, data).then((r) => r.data.data),

  toggleActive: (id, isActive) =>
    apiClient.patch(`/staff/${id}`, { isActive }).then((r) => r.data.data),
};

export const inventoryApi = {
  getItems: (params = {}) =>
    apiClient.get('/inventory', { params }).then((r) => r.data.data),

  createItem: (data) =>
    apiClient.post('/inventory', data).then((r) => r.data.data),

  updateItem: (id, data) =>
    apiClient.patch(`/inventory/${id}`, data).then((r) => r.data.data),

  adjustStock: (id, data) =>
    apiClient.post(`/inventory/${id}/adjust`, data).then((r) => r.data.data),

  getLowStock: () =>
    apiClient.get('/inventory/low-stock').then((r) => r.data.data),

  getConsumptionReport: (period = 'thisMonth') =>
    apiClient.get(`/inventory/consumption?period=${period}`).then((r) => r.data.data),
};

export const adminApi = {
  getPlatformMetrics: () =>
    apiClient.get('/admin/metrics').then((r) => r.data.data),

  getLabs: (params = {}) =>
    apiClient.get('/admin/labs', { params }).then((r) => r.data.data),

  getLabById: (id) =>
    apiClient.get(`/admin/labs/${id}`).then((r) => r.data.data),

  updateLabConfig: (id, data) =>
    apiClient.put(`/admin/labs/${id}/config`, data).then((r) => r.data.data),

  suspendLab: (id, reason) =>
    apiClient.post(`/admin/labs/${id}/suspend`, { reason }).then((r) => r.data.data),

  restoreLab: (id) =>
    apiClient.post(`/admin/labs/${id}/restore`).then((r) => r.data.data),

  impersonate: (labId, userId, reason) =>
    apiClient.post('/admin/impersonate', { labId, userId, reason }).then((r) => r.data.data),

  getAuditLogs: (labId, params = {}) =>
    apiClient.get(`/admin/labs/${labId}/audit`, { params }).then((r) => r.data.data),

  updateBilling: (labId, data) =>
    apiClient.put(`/admin/labs/${labId}/billing`, data).then((r) => r.data.data),
};

export const homeCollectionsApi = {
  getList: (params = {}) =>
    apiClient.get('/home-collections', { params }).then((r) => r.data.data),

  create: (data) =>
    apiClient.post('/home-collections', data).then((r) => r.data.data),

  getMyJobs: (params = {}) =>
    apiClient.get('/home-collections/my-jobs', { params }).then((r) => r.data.data),

  updateStatus: (id, data) =>
    apiClient.put(`/home-collections/${id}/status`, data).then((r) => r.data.data),

  collect: (id, data) =>
    apiClient.post(`/home-collections/${id}/collect`, data).then((r) => r.data.data),

  sync: (actions) =>
    apiClient.post('/home-collections/sync', { actions }).then((r) => r.data.data),
};

export const settingsApi = {
  get: () =>
    apiClient.get('/settings').then((r) => r.data.data),

  update: (data) =>
    apiClient.put('/settings', data).then((r) => r.data.data),
};
