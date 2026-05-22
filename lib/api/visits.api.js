import { apiClient } from './client.js';

export const visitsApi = {
  getList: (params = {}) =>
    apiClient.get('/visits', { params }).then((r) => r.data.data),

  getById: (id) =>
    apiClient.get(`/visits/${id}`).then((r) => r.data.data),

  create: (data) =>
    apiClient.post('/visits', data).then((r) => r.data.data),

  addTests: (id, testIds) =>
    apiClient.post(`/visits/${id}/tests`, { testIds }).then((r) => r.data.data),

  updateStatus: (id, status) =>
    apiClient.patch(`/visits/${id}/status`, { status }).then((r) => r.data.data),
};
