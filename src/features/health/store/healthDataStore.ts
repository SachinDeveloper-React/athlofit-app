// ─── healthDataStore.ts ───────────────────────────────────────────────────────
// Stores current health data snapshot from Health Connect / HealthKit
// This store is cleared on logout to prevent data leakage between accounts

import { create } from 'zustand';
import { HealthData, defaultHealthData } from '../types/healthTypes';

interface HealthDataStore {
  data: HealthData;
  lastUpdated: Date | null;
  setData: (data: HealthData) => void;
  setLastUpdated: (date: Date | null) => void;
  reset: () => void;
}

export const useHealthDataStore = create<HealthDataStore>((set) => ({
  data: defaultHealthData,
  lastUpdated: null,
  
  setData: (data) => set({ data }),
  
  setLastUpdated: (date) => set({ lastUpdated: date }),
  
  reset: () => set({ 
    data: defaultHealthData, 
    lastUpdated: null 
  }),
}));
