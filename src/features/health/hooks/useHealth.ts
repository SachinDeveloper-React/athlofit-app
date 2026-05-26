import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { HealthData, defaultHealthData } from '../types/healthTypes';

import {
  initializeHealthKit,
  fetchAllHealthKitData,
  writeStepsHK,
  writeWeightHK,
  writeHydrationHK,
  writeHeartRateHK,       // ✅ new
  writeBloodPressureHK,   // ✅ new
  writeBloodGlucoseHK,    // ✅ new
  writeSleepHK,           // ✅ new
} from '../service/healthkit.service';

import {
  isHealthConnectAvailable,
  initializeHealthConnect,
  fetchAllHealthConnectData,
  writeStepsHC,
  writeWeightHC,
  writeHeartRateHC,
  writeBloodPressureHC,
  writeBloodGlucoseHC,
  writeSleepHC,
  writeHydrationHC,
} from '../service/healthConnect.service';

export type HealthPlatform = 'healthkit' | 'healthconnect' | 'unavailable';

interface UseHealthOptions {
  /** Auto-refresh interval in ms. Default 60s. Set 0 to disable. */
  refreshInterval?: number;
  /** Pause polling when app goes to background. Default true. */
  pauseInBackground?: boolean;
  /** User weight in kg for accurate calorie/distance derivation. Default 70. */
  weightKg?: number;
}

export function useHealth(options: UseHealthOptions = {}) {
  const {
    refreshInterval = 60_000,  // refresh every 10 s for near-real-time steps
    pauseInBackground = true,
    weightKg = 70,
  } = options;

  const [platform, setPlatform] = useState<HealthPlatform>('unavailable');
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<HealthData>(defaultHealthData);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const platformRef = useRef<HealthPlatform>('unavailable');
  const isReadyRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setup();
    return () => stopAutoRefresh();
  }, []);

  // Keep refs in sync with state
  useEffect(() => {
    platformRef.current = platform;
  }, [platform]);
  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  // ── Background / foreground handling ──────────────────────────────────────
  useEffect(() => {
    if (!pauseInBackground) return;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const wasBackground = ['background', 'inactive'].includes(
        appStateRef.current,
      );
      const isBackground = ['background', 'inactive'].includes(next);

      if (!wasBackground && isBackground) {
        stopAutoRefresh();
      } else if (wasBackground && !isBackground) {
        if (isReadyRef.current) {
          // Already initialised — just refresh data
          loadData(platformRef.current);
          startAutoRefresh();
        } else {
          // Not ready yet (e.g. user just granted permissions in Health Connect
          // and returned to the app) — re-run the full setup so isReady can
          // become true and the PermissionDeniedScreen goes away.
          setup();
        }
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [pauseInBackground, refreshInterval]);

  // ── Auto-refresh timer ────────────────────────────────────────────────────
  const startAutoRefresh = useCallback(() => {
    if (refreshInterval <= 0) return;
    stopAutoRefresh();
    intervalRef.current = setInterval(() => {
      // silent=true — don't show loading spinner on background polls,
      // only update the data when it arrives so the UI doesn't flash.
      if (isReadyRef.current) loadData(platformRef.current, true);
    }, refreshInterval);
  }, [refreshInterval]);

  const stopAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ── Setup ─────────────────────────────────────────────────────────────────
  const setup = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (Platform.OS === 'ios') {
        const ok = await initializeHealthKit();
        platformRef.current = ok ? 'healthkit' : 'unavailable';
        setPlatform(platformRef.current);
        isReadyRef.current = ok;
        setIsReady(ok);
        if (ok) {
          await loadData('healthkit');
          startAutoRefresh();
        }
      } else if (Platform.OS === 'android') {
        const available = await isHealthConnectAvailable();
        if (!available) {
          setPlatform('unavailable');
          setError(
            'Health Connect not installed. Please install it from the Play Store.',
          );
          return;
        }

        // Signal to the native WidgetUpdateWorker that we are about to
        // initialise Health Connect. This prevents the background worker from
        // calling HealthConnectClient concurrently, which crashes the app.
        const { widgetService } = await import('../../../services/widgetService');
        await widgetService.setAppInitialising(true);

        let ok = false;
        try {
          ok = await initializeHealthConnect();
        } finally {
          // Always clear the flag — even if init throws
          await widgetService.setAppInitialising(false);
        }

        platformRef.current = ok ? 'healthconnect' : 'unavailable';
        setPlatform(platformRef.current);
        isReadyRef.current = ok;
        setIsReady(ok);
        if (ok) {
          await loadData('healthconnect');
          startAutoRefresh();
        } else {
          // Health Connect unavailable — check if native step counter can provide data
          const { stepService } = await import('../../../services/stepService');
          if (stepService.getSource() === 'native_sensor') {
            // Native sensor is active — mark as ready so the UI renders with native step data
            platformRef.current = 'healthconnect'; // keep platform label for loadData routing
            isReadyRef.current = true;
            setIsReady(true);
            await loadData('healthconnect');
            startAutoRefresh();
          }
        }
      }
    } catch (e: any) {
      setError(e?.message ?? 'Unknown error during setup');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadData = async (p: HealthPlatform, silent: boolean = false) => {
    if (!silent) setIsLoading(true);
    try {
      let result: HealthData;
      if (p === 'healthkit') {
        result = await fetchAllHealthKitData();
      } else {
        // Get login timestamp from healthDataStore to filter historical data
        const { useHealthDataStore } = await import('../store/healthDataStore');
        const loginTimestamp = useHealthDataStore.getState().loginTimestamp;
        result = await fetchAllHealthConnectData(weightKg, loginTimestamp);
      }

      // If native step counter is active, use its value as the step count.
      // This ensures steps show immediately (native counter updates in real-time)
      // rather than waiting for the 5-min Health Connect write cycle.
      const { stepService } = await import('../../../services/stepService');
      if (stepService.getSource() === 'native_sensor') {
        const nativeSteps = await stepService.getCurrentSteps();
        if (nativeSteps > 0 || result.steps === 0) {
          result = { ...result, steps: nativeSteps };
        }
      }

      setData(result);
      setLastUpdated(new Date());
    } catch (e: any) {
      if (!silent) setError(e?.message ?? 'Failed to load health data');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // ── Manual refresh ────────────────────────────────────────────────────────
  const refresh = useCallback(
    (silent: boolean = false) => {
      if (!isReadyRef.current) return;
      stopAutoRefresh();
      loadData(platformRef.current, silent).then(() => startAutoRefresh());
    },
    [refreshInterval],
  );

  // ── Manual log methods — routed by platform ───────────────────────────────

  const logHeartRate = useCallback(
    async (bpm: number) => {
      if (platform === 'healthkit') await writeHeartRateHK(bpm); // ✅ iOS
      else await writeHeartRateHC(bpm);                          // Android
      setData(prev => ({ ...prev, heartRate: bpm }));
      setLastUpdated(new Date());
    },
    [platform],
  );

  const logBloodPressure = useCallback(
    async (systolic: number, diastolic: number) => {
      if (platform === 'healthkit')
        await writeBloodPressureHK(systolic, diastolic); // ✅ iOS
      else await writeBloodPressureHC(systolic, diastolic);      // Android
      setData(prev => ({
        ...prev,
        bloodPressureSystolic: systolic,
        bloodPressureDiastolic: diastolic,
      }));
      setLastUpdated(new Date());
    },
    [platform],
  );

  const logWeight = useCallback(
    async (kg: number) => {
      if (platform === 'healthkit') await writeWeightHK(kg, new Date());
      else await writeWeightHC(kg, new Date());
      setData(prev => ({ ...prev, weight: kg }));
      setLastUpdated(new Date());
    },
    [platform],
  );

  const logBloodGlucose = useCallback(
    async (mmol: number) => {
      if (platform === 'healthkit') await writeBloodGlucoseHK(mmol); // ✅ iOS
      else await writeBloodGlucoseHC(mmol);                          // Android
      setData(prev => ({ ...prev, bloodGlucose: mmol }));
      setLastUpdated(new Date());
    },
    [platform],
  );

  const logSleep = useCallback(
    async (bedtime: Date, wakeTime: Date) => {
      if (platform === 'healthkit')
        await writeSleepHK(bedtime, wakeTime); // ✅ iOS
      else await writeSleepHC(bedtime, wakeTime);     // Android
      const sleepHours =
        Math.round(
          ((wakeTime.getTime() - bedtime.getTime()) / 3_600_000) * 10,
        ) / 10;
      setData(prev => ({ ...prev, sleepHours }));
      setLastUpdated(new Date());
    },
    [platform],
  );

  // ── Legacy step / weight / hydration write ────────────────────────────────

  const writeSteps = useCallback(
    async (count: number, start: Date, end: Date) => {
      if (platform === 'healthkit') await writeStepsHK(count, start);
      else await writeStepsHC(count, start, end);
    },
    [platform],
  );

  const writeWeight = useCallback(
    async (kg: number, date: Date) => {
      if (platform === 'healthkit') await writeWeightHK(kg, date);
      else await writeWeightHC(kg, date);
    },
    [platform],
  );

  const writeHydration = useCallback(
    async (ml: number, start: Date, end: Date) => {
      if (platform === 'healthkit') await writeHydrationHK(ml, start);
      else await writeHydrationHC(ml, start, end);
    },
    [platform],
  );

  return {
    platform,
    isReady,
    isLoading,
    data,
    error,
    lastUpdated,
    refresh,
    logHeartRate,
    logBloodPressure,
    logWeight,
    logBloodGlucose,
    logSleep,
    writeSteps,
    writeWeight,
    writeHydration,
  };
}
