import { useCallback, useEffect } from 'react';
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

export const useHydration = () => {
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
  useEffect(() => {
    if (!isReady || healthLoading) return;
    const currentConsumed = useHydrationStore.getState().consumed;
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
      } catch (error) {
        console.log('error', error);
      }
    },
    [storeAddWater, writeHydration],
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
  }, [storeResetDay, platform]);

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
