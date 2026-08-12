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
  /**
   * Device steps this device last successfully synced to the server today.
   *
   * Used for echo detection: this device both writes and reads the server's step
   * field, so reading it back can feed the device its own output. When the server
   * returns a value no higher than this, it carries no new information and is
   * ignored. When it is higher, another device or session genuinely contributed
   * and the value is trusted as a floor. See stepEngine.detectServerEcho.
   */
  lastPushedSteps: number;
  lastPushedStepsDate: string | null;
  setData: (data: HealthData) => void;
  setLastUpdated: (date: Date | null) => void;
  setLoginTimestamp: (timestamp: number) => void;
  setLastFetchedAt: (timestamp: number) => void;
  setSyncedStepOffset: (steps: number, date: string) => void;
  setSyncedServerBaseline: (baseline: HealthData | null, date: string) => void;
  setStepOffsetFetched: (fetched: boolean) => void;
  setBonusSteps: (steps: number, date: string) => void;
  setNativeStepsAtLogin: (steps: number) => void;
  setLastPushedSteps: (steps: number, date: string) => void;
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
      lastPushedSteps: 0,
      lastPushedStepsDate: null,
      
      setData: (data) => set({ data }),
      
      setLastUpdated: (date) => set({ lastUpdated: date }),
      
      setLoginTimestamp: (timestamp) => set({ loginTimestamp: timestamp }),

      setLastFetchedAt: (timestamp) => set({ lastFetchedAt: timestamp }),

      setSyncedStepOffset: (steps, date) => set({ syncedStepOffset: steps, syncedStepOffsetDate: date }),

      setSyncedServerBaseline: (baseline, date) => set({ syncedServerBaseline: baseline, syncedServerBaselineDate: date }),

      setStepOffsetFetched: (fetched) => set({ stepOffsetFetched: fetched }),

      setBonusSteps: (steps, date) => set({ bonusSteps: steps, bonusStepsDate: date }),

      setNativeStepsAtLogin: (steps) => set({ nativeStepsAtLogin: steps }),

      setLastPushedSteps: (steps, date) => set({ lastPushedSteps: steps, lastPushedStepsDate: date }),
      
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
        lastPushedSteps: 0,
        lastPushedStepsDate: null,
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
        lastPushedSteps: state.lastPushedSteps,
        lastPushedStepsDate: state.lastPushedStepsDate,
      }),
    }
  )
);
