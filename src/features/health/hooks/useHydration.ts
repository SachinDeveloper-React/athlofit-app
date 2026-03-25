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
  } = useHealth();

  // ── On mount: load history + sync health platform ──────────────────────────
  useEffect(() => {
    const init = async () => {
      // 1. Fetch today's history from backend
      //   await fetchHistory();

      if (isReady && !healthLoading) setConsumed(data?.hydration);
    };

    init();
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
    await Promise.allSettled([
      storeResetDay(),
      deleteRecordsByTimeRange('Hydration', buildTodayFilter()).catch(e =>
        console.warn('[HC] Previous days hydration delete failed:', e),
      ),
    ]);
  }, [storeResetDay, writeHydration]);

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
