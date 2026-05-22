import { apiClient } from './client.js';

export const analyticsApi = {
  getDashboardSummary: () =>
    apiClient.get('/analytics/dashboard').then((r) => r.data.data),

  getRevenueAnalytics: (period = '30days') =>
    apiClient.get(`/analytics/revenue?period=${period}`).then((r) => r.data.data),

  getHealthScore: () =>
    apiClient.get('/analytics/health-score').then((r) => r.data.data),

  getTestAnalytics: (period = '30days') =>
    apiClient.get(`/analytics/tests?period=${period}`).then((r) => r.data.data),

  getOperationsAnalytics: (period = '30days') =>
    apiClient.get(`/analytics/operations?period=${period}`).then((r) => r.data.data),
};
