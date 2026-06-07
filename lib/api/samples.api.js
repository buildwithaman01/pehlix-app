import { apiClient } from './client.js';

export const samplesApi = {
  getPending: () =>
    apiClient.get('/samples/pending').then((r) => r.data.data),

  scan: (barcodeId) =>
    apiClient.post('/samples/scan', { barcodeId }).then((r) => r.data.data),

  updateStatus: (id, status, notes, storageLocation) =>
    apiClient.put(`/samples/${id}/status`, { status, notes, storageLocation }).then((r) => r.data.data),

  reject: (id, rejectionReason) =>
    apiClient.post(`/samples/${id}/reject`, { rejectionReason }).then((r) => r.data.data),
    
  getChain: (id) =>
    apiClient.get(`/samples/${id}/chain`).then((r) => r.data.data),
};
