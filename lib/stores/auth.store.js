import { create } from 'zustand'

export const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  setUser: (user, token) => set({ 
    user, 
    accessToken: token, 
    isAuthenticated: !!user, 
    isLoading: false,
    isInitialized: true
  }),
  clearUser: () => set({ 
    user: null, 
    accessToken: null, 
    isAuthenticated: false, 
    isLoading: false,
    isInitialized: true
  }),
  setLoading: (isLoading) => set({ isLoading }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  getAccessToken: () => get().accessToken,
}))

export const getAccessToken = () => useAuthStore.getState().accessToken
