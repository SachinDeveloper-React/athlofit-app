// src/features/health/hooks/useStepCoinEarnings.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { stepService } from '../../../services/stepService';
import { useStepCoinRate } from '../../../store/appConfigStore';
import { useHealthDataStore } from '../store/healthDataStore';

const SYNC_INTERVAL_MS = 30_000; // 30 seconds

/**
 * Hook that calculates real-time step-based coin earnings
 * using the backend-configurable step coin rate.
 *
 * - Subscribes to native step sensor updates for live recalculation
 * - Includes synced step offset (cross-device steps) in the calculation
 * - Runs a periodic timer (≤30s) to poll for the latest step count
 * - Exposes earnings, steps, isStale, and lastCalcTime
 *
 * NOTE: Coin transactions are logged on the backend every 3 hours
 * (not per-100-steps) to avoid duplicate entries. This hook only
 * calculates the display value — actual balance comes from the server.
 */
export function useStepCoinEarnings() {
  const rate = useStepCoinRate();
  const [steps, setSteps] = useState(0);
  const [lastCalcTime, setLastCalcTime] = useState(Date.now());
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Get today's synced step offset (steps from other devices) */
  const getOffset = useCallback(() => {
    const { syncedStepOffset, syncedStepOffsetDate } = useHealthDataStore.getState();
    const today = new Date().toISOString().split('T')[0];
    return syncedStepOffsetDate === today ? syncedStepOffset : 0;
  }, []);

  const calculateEarnings = useCallback(
    (currentSteps: number) => {
      // Keep 2 decimal places for fractional coin display
      return parseFloat((Math.floor(currentSteps / 100) * rate).toFixed(2));
    },
    [rate],
  );

  // Subscribe to real-time step updates from the native sensor
  useEffect(() => {
    const unsubscribe = stepService.onStepUpdate((newSteps) => {
      setSteps(newSteps + getOffset());
      setLastCalcTime(Date.now());
    });
    return unsubscribe;
  }, [getOffset]);

  // Periodic recalculation (≤30s interval)
  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      const currentSteps = await stepService.getCurrentSteps();
      setSteps(currentSteps + getOffset());
      setLastCalcTime(Date.now());
    }, SYNC_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [getOffset]);

  const earnings = calculateEarnings(steps);
  const isStale = Date.now() - lastCalcTime > SYNC_INTERVAL_MS;

  return { earnings, steps, isStale, lastCalcTime };
}
