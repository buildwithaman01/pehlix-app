import { apiClient } from './client.js';

export const testsApi = {
  search: (query, params = {}) =>
    apiClient
      .get('/tests', { params: { search: query, ...params } })
      .then((r) => r.data.data),

  getById: (id) =>
    apiClient.get(`/tests/${id}`).then((r) => r.data.data),

  getPackages: () =>
    apiClient.get('/tests/packages').then((r) => r.data.data),

  getMasterCatalog: (query) =>
    apiClient.get('/tests/master', { params: { search: query } }).then((r) => r.data.data),

  importTest: (data) =>
    apiClient.post('/tests', data).then((r) => r.data.data),

  updateTest: (id, data) =>
    apiClient.patch(`/tests/${id}`, data).then((r) => r.data.data),
};
