// ─── hydrationStore.ts ────────────────────────────────────────────────────────

import { create } from 'zustand';
import {
  subscribeWithSelector,
  persist,
  createJSONStorage,
} from 'zustand/middleware';
import { HistoryEntry, HydrationStore } from '../types/hydration.type';
import { hydrationService } from '../service/hydration.service';
import { mmkvStorage } from '../../../store';

const sumConsumed = (entries: HistoryEntry[]): number => {
  const todayStr = new Date().toDateString();
  return entries
    .filter(e => new Date(e.time).toDateString() === todayStr)
    .reduce((acc, e) => acc + e.amount, 0);
};

export const useHydrationStore = create<HydrationStore>()(
  persist(
    subscribeWithSelector((set, get) => ({
      consumed: 0,
      dailyGoal: 5000,
      history: [],
      isLoading: false,
      isSyncing: false,
      error: null,
      lastResetDate: '', // ← tracks which calendar day was last reset

      // ── Setters ────────────────────────────────────────────────────────────
      setHistory: (entries: HistoryEntry[]) =>
        set({ history: entries, consumed: sumConsumed(entries) }),

      setConsumed: (amount: number) => set({ consumed: amount }),

      setLoading: (loading: boolean) => set({ isLoading: loading }),

      setSyncing: (syncing: boolean) => set({ isSyncing: syncing }),

      setError: (error: string | null) => set({ error }),

      // ── Midnight reset guard ───────────────────────────────────────────────
      // Call on app launch — resets if persisted date differs from today.
      checkAndResetIfNewDay: () => {
        const today = new Date().toDateString();
        const { lastResetDate } = get();
        if (lastResetDate !== today) {
          set({
            history: [],
            consumed: 0,
            lastResetDate: today,
            error: null,
          });
          console.log('[Hydration] New day detected — store reset to 0');
        }
      },

      // ── fetchHistory ───────────────────────────────────────────────────────
      fetchHistory: async () => {
        set({ isLoading: true, error: null });
        try {
          const token = 'AUTH_TOKEN_PLACEHOLDER';
          const entries = await hydrationService.fetchTodayHistory(token);
          const sorted = [...entries].sort(
            (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
          );
          set({
            history: sorted,
            consumed: sumConsumed(sorted),
            isLoading: false,
          });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Failed to fetch history';
          set({ isLoading: false, error: message });
        }
      },

      // ── addWater ───────────────────────────────────────────────────────────
      addWater: async amount => {
        const { history } = get();

        const optimisticEntry: HistoryEntry = {
          id: `optimistic-${Date.now()}`,
          amount,
          time: new Date(),
          source: 'manual',
        };

        const filteredHistory = history.filter(
          e => e.source !== 'health_connect',
        );
        const optimisticHistory = [optimisticEntry, ...filteredHistory];

        set({
          history: optimisticHistory,
          consumed: sumConsumed(optimisticHistory),
          error: null,
        });
      },

      // ── resetDay ───────────────────────────────────────────────────────────
      resetDay: async () => {
        const { history } = get();
        const today = new Date().toDateString();

        set({ history: [], consumed: 0, error: null, lastResetDate: today });

        // try {
        //   const token = 'AUTH_TOKEN_PLACEHOLDER';
        //   await hydrationService.resetToday(token);
        // } catch (err) {
        //   set({
        //     history,
        //     consumed: sumConsumed(history),
        //     error: 'Failed to reset. Please try again.',
        //   });
        // }
      },
    })),
    {
      name: 'hydration-store',
      storage: createJSONStorage(() => mmkvStorage),
      // Persist everything except transient flags
      partialize: state => ({
        consumed: state.consumed,
        dailyGoal: state.dailyGoal,
        history: state.history,
        lastResetDate: state.lastResetDate,
      }),
    },
  ),
);

// ─── Selectors ────────────────────────────────────────────────────────────────
export const selectPercentage = (state: HydrationStore) =>
  Math.min((state.consumed / state.dailyGoal) * 100, 100);

export const selectRemaining = (state: HydrationStore) =>
  Math.max(state.dailyGoal - state.consumed, 0);

export const selectStatusMessage = (state: HydrationStore) => {
  const pct = selectPercentage(state);
  if (pct >= 100) return '🎉 Goal Achieved!';
  if (pct >= 75) return '💪 Almost there!';
  if (pct >= 50) return '👍 Halfway done!';
  if (pct >= 25) return '🌊 Keep going!';
  return '💧 Start hydrating!';
};
