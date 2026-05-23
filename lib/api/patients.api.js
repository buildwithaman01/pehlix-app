import { apiClient } from './client.js';

export const patientsApi = {
  search: (q) =>
    apiClient.get(`/patients/search?q=${encodeURIComponent(q)}`).then((r) => r.data.data),

  autofill: (phone) =>
    apiClient.get(`/patients/autofill?phone=${phone}`).then((r) => r.data.data),

  getById: (id) =>
    apiClient.get(`/patients/${id}`).then((r) => r.data.data),

  getList: (params = {}) =>
    apiClient.get('/patients', { params }).then((r) => r.data.data),

  create: (data) =>
    apiClient.post('/patients', data).then((r) => r.data.data),

  update: (id, data) =>
    apiClient.patch(`/patients/${id}`, data).then((r) => r.data.data),

  getHistory: (id) =>
    apiClient.get(`/patients/${id}/history`).then((r) => r.data.data),
};
