import { apiClient } from './client.js';

export const homeCollectionsApi = {
  getAll: () =>
    apiClient.get('/home-collections').then((r) => r.data.data),

  createBooking: (data) =>
    apiClient.post('/home-collections', data).then((r) => r.data.data),

  updateStatus: (id, data) =>
    apiClient.put(`/home-collections/${id}/status`, data).then((r) => r.data.data),

  getMyJobs: () =>
    apiClient.get('/home-collections/my-jobs').then((r) => r.data.data),
};
