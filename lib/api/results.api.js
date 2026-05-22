import { apiClient } from './client.js';

export const resultsApi = {
  getWorkQueue: () =>
    apiClient.get('/results/worklist').then((r) => r.data.data),

  getById: (id) =>
    apiClient.get(`/results/${id}`).then((r) => r.data.data),

  submit: (data) =>
    apiClient.post('/results', data).then((r) => r.data.data),

  update: (id, data) =>
    apiClient.patch(`/results/${id}`, data).then((r) => r.data.data),

  getApprovalQueue: () =>
    apiClient.get('/results/pathologist/queue').then((r) => r.data.data),

  approve: (id, clinicalNote) =>
    apiClient.post(`/results/${id}/approve`, { clinicalNote }).then((r) => r.data.data),

  reject: (id, rejectionNote) =>
    apiClient.post(`/results/${id}/reject`, { rejectionNote }).then((r) => r.data.data),

  acknowledgeAlert: (alertId) =>
    apiClient.post(`/critical/acknowledge/${alertId}`).then((r) => r.data.data),
};
