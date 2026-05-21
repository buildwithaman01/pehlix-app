import { create } from 'zustand'

export const useLabStore = create((set) => ({
  lab: null,
  planConfig: null,
  setLab: (lab) => set({ lab }),
  setPlanConfig: (config) => set({ planConfig: config }),
  clearLab: () => set({ lab: null, planConfig: null }),
}))
