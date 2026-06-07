import { apiClient } from './client.js';

export const publicApi = {
  getLabProfile: (slug) => 
    apiClient.get(`/public/labs/${slug}`).then(res => res.data.data),

  createBooking: (payload) => 
    apiClient.post('/public/bookings', payload).then(res => res.data.data),
};
