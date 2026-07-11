import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useHydrationStore,
  selectPercentage,
  selectRemaining,
  selectStatusMessage,
} from '../store/hydrationStore';
import { useHealth } from './useHealth';
import { DrinkSize } from '../types/hydration.type';
import { deleteRecordsByTimeRange } from 'react-native-health-connect';
import { buildTodayFilter } from '../utils/healthFormatters';
import { healthService } from '../service/health.service';
import { getTimezone } from '../../../utils/timezone';

export const useHydration = () => {
  const queryClient = useQueryClient();
  const {
    consumed,
    dailyGoal,
    history,
    isLoading,
    isSyncing,
    error,
    fetchHistory,
    addWater: storeAddWater,
    resetDay: storeResetDay,
    setConsumed,
  } = useHydrationStore();

  const percentage = useHydrationStore(selectPercentage);
  const remaining = useHydrationStore(selectRemaining);
  const statusMessage = useHydrationStore(selectStatusMessage);
  const {
    writeHydration,
    data,
    isReady,
    isLoading: healthLoading,
    platform,
  } = useHealth();

  // ── On mount: load history + sync health platform ──────────────────────────
  // Only set consumed from Health Connect on the INITIAL load (when hydration
  // store consumed is 0 and Health Connect has a non-zero value). After that,
  // the store's optimistic updates from addWater are the source of truth.
  // IMPORTANT: Skip if user already reset today — otherwise Health Connect's
  // stale data would overwrite the reset back to the old value.
  useEffect(() => {
    if (!isReady || healthLoading) return;
    const { consumed: currentConsumed, lastResetDate } = useHydrationStore.getState();
    const today = new Date().toDateString();
    // If the user already reset today, don't re-sync from Health Connect
    if (lastResetDate === today) return;
    // Only sync from Health Connect if the store has no local data yet
    if (currentConsumed === 0 && data?.hydration > 0) {
      setConsumed(data.hydration);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, healthLoading]);

  // ── addWater: store update + health write ──────────────────────────────────
  const addWater = useCallback(
    async (amount: DrinkSize) => {
      try {
        const end = new Date();
        const start = new Date(end.getTime() - 60_000); // 1 min before end ✅

        await Promise.allSettled([
          storeAddWater(amount),
          writeHydration(amount, start, end),
        ]);

        // Refresh claim button state when water intake crosses the goal
        const { consumed: newConsumed, dailyGoal: goal } = useHydrationStore.getState();
        if (newConsumed >= goal) {
          // Trigger a health sync so the backend receives the updated hydration
          // value and can mark hydration_daily as claimable. Without this, the
          // coin-data refetch returns stale data because the backend hasn't seen
          // the new hydration total yet.
          healthService.syncHealthData({ hydration: newConsumed, timezone: getTimezone() }).catch(() => {});

          // Invalidate after a short delay to let the sync complete
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['coin-data'] });
            queryClient.invalidateQueries({ queryKey: ['coin-transactions'] });
          }, 1500);
        }
      } catch (error) {
        console.log('error', error);
      }
    },
    [storeAddWater, writeHydration, queryClient],
  );

  // ── resetDay ───────────────────────────────────────────────────────────────
  const resetDay = useCallback(async () => {
    const promises: Promise<any>[] = [storeResetDay()];
    if (platform === 'healthconnect') {
      promises.push(
        deleteRecordsByTimeRange('Hydration', buildTodayFilter()).catch(e =>
          console.warn('[HC] Previous days hydration delete failed:', e),
        ),
      );
    }
    await Promise.allSettled(promises);

    // Sync hydration=0 to backend so it knows the user reset their water intake.
    // The backend will revert the hydration reward AND hydration challenges,
    // deducting any coins that were earned from them.
    healthService.syncHealthData({ hydration: 0, timezone: getTimezone() }).catch(() => {});

    // Refresh earn-coins, challenges, and gamification state after hydration reset
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['coin-data'] });
      queryClient.invalidateQueries({ queryKey: ['coin-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    }, 1500);
  }, [storeResetDay, platform, queryClient]);

  return {
    // Data
    consumed,
    dailyGoal,
    history,
    percentage,
    remaining,
    statusMessage,

    // State flags
    isLoading,
    isSyncing,
    error,

    // Actions
    addWater,
    resetDay,
    refetchHistory: fetchHistory,
  };
};
