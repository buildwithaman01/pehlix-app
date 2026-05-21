import { create } from 'zustand'

export const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
  setUser: (user, token) => set({ 
    user, 
    accessToken: token, 
    isAuthenticated: !!user, 
    isLoading: false 
  }),
  clearUser: () => set({ 
    user: null, 
    accessToken: null, 
    isAuthenticated: false, 
    isLoading: false 
  }),
  setLoading: (isLoading) => set({ isLoading }),
  getAccessToken: () => get().accessToken,
}))

export const getAccessToken = () => useAuthStore.getState().accessToken
