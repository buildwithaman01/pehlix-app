import { apiClient } from './client.js';

export const samplesApi = {
  getQueue: () =>
    apiClient.get('/samples/queue').then((r) => r.data.data),

  scan: (barcodeId) =>
    apiClient.post('/samples/scan', { barcodeId }).then((r) => r.data.data),

  updateStatus: (id, status, notes) =>
    apiClient.patch(`/samples/${id}/status`, { status, notes }).then((r) => r.data.data),

  reject: (id, rejectionReason) =>
    apiClient.post(`/samples/${id}/reject`, { rejectionReason }).then((r) => r.data.data),
};
