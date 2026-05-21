import { useAuthStore } from '../stores/auth.store';
import apiClient from '../api/client';

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, clearUser, setLoading } = useAuthStore();

  const login = async (credentials) => {
    setLoading(true);
    try {
      const response = await apiClient.post('/auth/login', credentials);
      const { user: userData, accessToken } = response.data.data;
      setUser(userData, accessToken);
      return response.data.data;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearUser();
    }
  };

  return {
    user,
    isAuthenticated,
    login,
    logout,
    isLoading,
  };
}
