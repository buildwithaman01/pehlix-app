import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

const apiClient = axios.create({
  baseURL: (process.env.NEXT_PUBLIC_APP_URL || '') + '/api',
  withCredentials: true,
});

// Request interceptor: attach Authorization: Bearer token from auth store
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: on 401 - attempt token refresh via POST /auth/refresh, retry once
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if it's a 401 error and we haven't already retried this request
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If the failed request was the refresh request itself, we handle it as a final 401
      if (originalRequest.url.includes('/auth/refresh')) {
        useAuthStore.getState().clearUser();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        // Attempt token refresh via POST /auth/refresh
        const refreshResponse = await axios.post(
          `${apiClient.defaults.baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = refreshResponse.data.data.accessToken;
        const newUser = refreshResponse.data.data.user;

        // Update the auth store
        useAuthStore.getState().setUser(newUser, newAccessToken);

        // Update authorization header of the original request and retry
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // On failure or second 401, clear auth store and redirect to /login
        useAuthStore.getState().clearUser();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
export { apiClient };
