// ─── healthDataStore.ts ───────────────────────────────────────────────────────
// Stores current health data snapshot from Health Connect / HealthKit
// This store is cleared on logout to prevent data leakage between accounts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '../../../store';
import { HealthData, defaultHealthData } from '../types/healthTypes';

interface HealthDataStore {
  data: HealthData;
  lastUpdated: Date | null;
  loginTimestamp: number | null; // Timestamp when user logged in (to filter historical data)
  setData: (data: HealthData) => void;
  setLastUpdated: (date: Date | null) => void;
  setLoginTimestamp: (timestamp: number) => void;
  reset: () => void;
}

export const useHealthDataStore = create<HealthDataStore>()(
  persist(
    (set) => ({
      data: defaultHealthData,
      lastUpdated: null,
      loginTimestamp: null,
      
      setData: (data) => set({ data }),
      
      setLastUpdated: (date) => set({ lastUpdated: date }),
      
      setLoginTimestamp: (timestamp) => set({ loginTimestamp: timestamp }),
      
      reset: () => set({ 
        data: defaultHealthData, 
        lastUpdated: null,
        loginTimestamp: null,
      }),
    }),
    {
      name: 'health-data-store',
      storage: createJSONStorage(() => mmkvStorage),
      // Persist loginTimestamp so it survives app restarts
      partialize: (state) => ({ 
        loginTimestamp: state.loginTimestamp 
      }),
    }
  )
);
