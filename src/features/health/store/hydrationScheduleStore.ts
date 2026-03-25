// ─── hydrationScheduleStore.ts ────────────────────────────────────────────────
// Persists enabled alarm times locally with zustand + MMKV or AsyncStorage.
// Keeps UI in sync with what Notifee actually has scheduled.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import {
  scheduleHydrationAlarm,
  cancelHydrationAlarm,
  cancelAllHydrationAlarms,
  getScheduledAlarmTimes,
  setupHydrationChannel,
  requestNotificationPermission,
} from '../service/hydrationNotification.service.ts';
import { mmkvStorage } from '../../../store/index.ts';

// ─── Preset slots ─────────────────────────────────────────────────────────────
export const PRESET_TIMES: string[] = [
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
];

// ─── Types ────────────────────────────────────────────────────────────────────
export interface HydrationScheduleStore {
  /** "HH:MM" strings that are currently scheduled */
  scheduledTimes: string[];
  isLoading: boolean;
  error: string | null;
  permissionGranted: boolean;

  // Actions
  initSchedule: () => Promise<void>;
  toggleAlarm: (timeStr: string) => Promise<void>;
  addCustomAlarm: (timeStr: string) => Promise<void>;
  removeAlarm: (timeStr: string) => Promise<void>;
  clearAllAlarms: () => Promise<void>;
  setPermissionGranted: (val: boolean) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useHydrationScheduleStore = create<HydrationScheduleStore>()(
  persist(
    (set, get) => ({
      scheduledTimes: [],
      isLoading: false,
      error: null,
      permissionGranted: false,

      // ── Init: sync persisted state with actual Notifee triggers ─────────────
      initSchedule: async () => {
        set({ isLoading: true, error: null });
        try {
          await setupHydrationChannel();
          const granted = await requestNotificationPermission();
          set({ permissionGranted: granted });

          if (granted) {
            // Reconcile: re-schedule any persisted times that Notifee lost
            // (e.g. after app reinstall / device reboot)
            const active = await getScheduledAlarmTimes();
            const { scheduledTimes } = get();

            for (const t of scheduledTimes) {
              if (!active.includes(t)) {
                await scheduleHydrationAlarm(t).catch(() => {});
              }
            }
          }
        } catch (e) {
          set({ error: 'Failed to initialize notifications' });
        } finally {
          set({ isLoading: false });
        }
      },

      // ── Toggle a preset on/off ───────────────────────────────────────────
      toggleAlarm: async (timeStr: string) => {
        const { scheduledTimes } = get();
        const isOn = scheduledTimes.includes(timeStr);

        try {
          if (isOn) {
            await cancelHydrationAlarm(timeStr);
            set({ scheduledTimes: scheduledTimes.filter(t => t !== timeStr) });
          } else {
            await scheduleHydrationAlarm(timeStr);
            set({
              scheduledTimes: [...scheduledTimes, timeStr].sort(),
            });
          }
        } catch (e) {
          set({ error: `Failed to ${isOn ? 'cancel' : 'schedule'} alarm` });
        }
      },

      // ── Add a custom time (if not already in list) ────────────────────────
      addCustomAlarm: async (timeStr: string) => {
        const { scheduledTimes } = get();
        if (scheduledTimes.includes(timeStr)) return;

        try {
          await scheduleHydrationAlarm(timeStr);
          set({ scheduledTimes: [...scheduledTimes, timeStr].sort() });
        } catch (e) {
          set({ error: 'Failed to schedule custom alarm' });
        }
      },

      // ── Remove a specific time ────────────────────────────────────────────
      removeAlarm: async (timeStr: string) => {
        try {
          await cancelHydrationAlarm(timeStr);
          set(s => ({
            scheduledTimes: s.scheduledTimes.filter(t => t !== timeStr),
          }));
        } catch (e) {
          set({ error: 'Failed to remove alarm' });
        }
      },

      // ── Clear all ─────────────────────────────────────────────────────────
      clearAllAlarms: async () => {
        try {
          await cancelAllHydrationAlarms();
          set({ scheduledTimes: [] });
        } catch (e) {
          set({ error: 'Failed to clear alarms' });
        }
      },

      setPermissionGranted: (val: boolean) => set({ permissionGranted: val }),
    }),
    {
      name: 'hydration-schedule',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: state => ({ scheduledTimes: state.scheduledTimes }),
    },
  ),
);
