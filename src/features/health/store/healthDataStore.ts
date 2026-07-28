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
  lastFetchedAt: number | null; // Timestamp of last successful health data fetch
  syncedStepOffset: number; // Steps synced from server on login (from previous device)
  syncedStepOffsetDate: string | null; // Date (YYYY-MM-DD) the offset applies to
  syncedServerBaseline: HealthData | null; // Full health data from server for today (cross-device/reinstall)
  syncedServerBaselineDate: string | null; // Date the baseline applies to
  stepOffsetFetched: boolean; // Whether the step offset fetch has completed (success or fail)
  bonusSteps: number; // Bonus steps credited by admin/system for today
  bonusStepsDate: string | null; // Date the bonus applies to (resets daily)
  nativeStepsAtLogin: number; // Native sensor step count at login time (to compute post-login delta)
  setData: (data: HealthData) => void;
  setLastUpdated: (date: Date | null) => void;
  setLoginTimestamp: (timestamp: number) => void;
  setLastFetchedAt: (timestamp: number) => void;
  setSyncedStepOffset: (steps: number, date: string) => void;
  setSyncedServerBaseline: (baseline: HealthData | null, date: string) => void;
  setStepOffsetFetched: (fetched: boolean) => void;
  setBonusSteps: (steps: number, date: string) => void;
  setNativeStepsAtLogin: (steps: number) => void;
  reset: () => void;
}

export const useHealthDataStore = create<HealthDataStore>()(
  persist(
    (set) => ({
      data: defaultHealthData,
      lastUpdated: null,
      loginTimestamp: null,
      lastFetchedAt: null,
      syncedStepOffset: 0,
      syncedStepOffsetDate: null,
      syncedServerBaseline: null,
      syncedServerBaselineDate: null,
      stepOffsetFetched: false,
      bonusSteps: 0,
      bonusStepsDate: null,
      nativeStepsAtLogin: 0,
      
      setData: (data) => set({ data }),
      
      setLastUpdated: (date) => set({ lastUpdated: date }),
      
      setLoginTimestamp: (timestamp) => set({ loginTimestamp: timestamp }),

      setLastFetchedAt: (timestamp) => set({ lastFetchedAt: timestamp }),

      setSyncedStepOffset: (steps, date) => set({ syncedStepOffset: steps, syncedStepOffsetDate: date }),

      setSyncedServerBaseline: (baseline, date) => set({ syncedServerBaseline: baseline, syncedServerBaselineDate: date }),

      setStepOffsetFetched: (fetched) => set({ stepOffsetFetched: fetched }),

      setBonusSteps: (steps, date) => set({ bonusSteps: steps, bonusStepsDate: date }),

      setNativeStepsAtLogin: (steps) => set({ nativeStepsAtLogin: steps }),
      
      reset: () => set({ 
        data: defaultHealthData, 
        lastUpdated: null,
        loginTimestamp: null,
        lastFetchedAt: null,
        syncedStepOffset: 0,
        syncedStepOffsetDate: null,
        syncedServerBaseline: null,
        syncedServerBaselineDate: null,
        stepOffsetFetched: false,
        bonusSteps: 0,
        bonusStepsDate: null,
        nativeStepsAtLogin: 0,
      }),
    }),
    {
      name: 'health-data-store',
      storage: createJSONStorage(() => mmkvStorage),
      // Persist loginTimestamp, health data, lastUpdated, and lastFetchedAt so they survive app restarts
      partialize: (state) => ({ 
        loginTimestamp: state.loginTimestamp,
        data: state.data,
        lastUpdated: state.lastUpdated,
        lastFetchedAt: state.lastFetchedAt,
        syncedStepOffset: state.syncedStepOffset,
        syncedStepOffsetDate: state.syncedStepOffsetDate,
        syncedServerBaseline: state.syncedServerBaseline,
        syncedServerBaselineDate: state.syncedServerBaselineDate,
        stepOffsetFetched: state.stepOffsetFetched,
        bonusSteps: state.bonusSteps,
        bonusStepsDate: state.bonusStepsDate,
        nativeStepsAtLogin: state.nativeStepsAtLogin,
      }),
    }
  )
);
