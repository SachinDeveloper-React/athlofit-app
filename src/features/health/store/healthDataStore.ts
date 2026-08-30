// ─── healthDataStore.ts ───────────────────────────────────────────────────────
// Stores current health data snapshot from Health Connect / HealthKit
// This store is cleared on logout to prevent data leakage between accounts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '../../../store';
import { HealthData, defaultHealthData } from '../types/healthTypes';
import { getLocalToday } from '../../../utils/date';

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
  /**
   * Local day the {@link stepOffsetFetched} flag was set for.
   *
   * The flag is persisted, and without a date it stayed true forever after the
   * first login. loadData uses it to decide whether to wait (up to 3s) for
   * today's /health/today fetch, so on every subsequent day it skipped the wait
   * and could resolve the step count before the server baseline had arrived —
   * the exact race the wait exists to prevent. Every other cross-day value in
   * this store is date-stamped for the same reason.
   */
  stepOffsetFetchedDate: string | null;
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
  /**
   * Epoch ms of the last sync this device completed successfully, of any kind.
   *
   * Reported to the server as part of a sync's provenance. A large step jump has
   * two very different explanations — a backlog flushed after the phone was
   * offline, or a counting bug — and the gap since the last successful sync is
   * what separates them. The server cannot infer it: it only sees the syncs that
   * arrived, so a device that was offline and one that was idle look identical
   * from that side.
   */
  lastSyncedAt: number | null;
  setData: (data: HealthData) => void;
  setLastUpdated: (date: Date | null) => void;
  setLoginTimestamp: (timestamp: number) => void;
  setLastFetchedAt: (timestamp: number) => void;
  setSyncedStepOffset: (steps: number, date: string) => void;
  setSyncedServerBaseline: (baseline: HealthData | null, date: string) => void;
  setStepOffsetFetched: (fetched: boolean) => void;
  /** True only when the fetch flag was set for the current local day. */
  isStepOffsetFetchedToday: () => boolean;
  setBonusSteps: (steps: number, date: string) => void;
  setNativeStepsAtLogin: (steps: number) => void;
  setLastPushedSteps: (steps: number, date: string) => void;
  markSynced: (at?: number) => void;
  reset: () => void;
}

export const useHealthDataStore = create<HealthDataStore>()(
  persist(
    (set, get) => ({
      data: defaultHealthData,
      lastUpdated: null,
      loginTimestamp: null,
      lastFetchedAt: null,
      syncedStepOffset: 0,
      syncedStepOffsetDate: null,
      syncedServerBaseline: null,
      syncedServerBaselineDate: null,
      stepOffsetFetched: false,
      stepOffsetFetchedDate: null,
      bonusSteps: 0,
      bonusStepsDate: null,
      nativeStepsAtLogin: 0,
      lastPushedSteps: 0,
      lastPushedStepsDate: null,
      lastSyncedAt: null,
      
      setData: (data) => set({ data }),
      
      setLastUpdated: (date) => set({ lastUpdated: date }),
      
      setLoginTimestamp: (timestamp) => set({ loginTimestamp: timestamp }),

      setLastFetchedAt: (timestamp) => set({ lastFetchedAt: timestamp }),

      setSyncedStepOffset: (steps, date) => set({ syncedStepOffset: steps, syncedStepOffsetDate: date }),

      setSyncedServerBaseline: (baseline, date) => set({ syncedServerBaseline: baseline, syncedServerBaselineDate: date }),

      setStepOffsetFetched: (fetched) =>
        set({
          stepOffsetFetched: fetched,
          stepOffsetFetchedDate: fetched ? getLocalToday() : null,
        }),

      isStepOffsetFetchedToday: () => {
        const s = get();
        return s.stepOffsetFetched && s.stepOffsetFetchedDate === getLocalToday();
      },

      setBonusSteps: (steps, date) => set({ bonusSteps: steps, bonusStepsDate: date }),

      setNativeStepsAtLogin: (steps) => set({ nativeStepsAtLogin: steps }),

      setLastPushedSteps: (steps, date) => set({ lastPushedSteps: steps, lastPushedStepsDate: date }),

      markSynced: (at = Date.now()) => set({ lastSyncedAt: at }),
      
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
        stepOffsetFetchedDate: null,
        bonusSteps: 0,
        bonusStepsDate: null,
        nativeStepsAtLogin: 0,
        lastPushedSteps: 0,
        lastPushedStepsDate: null,
        lastSyncedAt: null,
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
        stepOffsetFetchedDate: state.stepOffsetFetchedDate,
        bonusSteps: state.bonusSteps,
        bonusStepsDate: state.bonusStepsDate,
        nativeStepsAtLogin: state.nativeStepsAtLogin,
        lastPushedSteps: state.lastPushedSteps,
        lastPushedStepsDate: state.lastPushedStepsDate,
        // Persisted deliberately: the gap this measures is usually a gap across
        // app restarts, so an in-memory-only value would read as "never synced"
        // in exactly the case it exists to describe.
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);
