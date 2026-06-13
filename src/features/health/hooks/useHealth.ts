import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { HealthData, defaultHealthData } from '../types/healthTypes';
import { useHealthDataStore } from '../store/healthDataStore';
import { useHealthInitStore } from '../store/healthInitStore';

import {
  initializeHealthKit,
  fetchAllHealthKitData,
  writeStepsHK,
  writeWeightHK,
  writeHydrationHK,
  writeHeartRateHK,
  writeBloodPressureHK,
} from '../service/healthkit.service';

import {
  isHealthConnectAvailable,
  initializeHealthConnect,
  fetchAllHealthConnectData,
  writeStepsHC,
  writeWeightHC,
  writeHeartRateHC,
  writeBloodPressureHC,
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

  // ── Cache hydration from MMKV store ──────────────────────────────────────
  const cachedData = useHealthDataStore.getState().data;
  const cachedLastUpdated = useHealthDataStore.getState().lastUpdated;
  const hasCachedData = cachedData !== null && cachedData !== defaultHealthData;

  // ── Pre-initialized state from splash/bootstrap ───────────────────────────
  const initState = useHealthInitStore.getState();
  const preInitialized = initState.isInitialized && initState.isReady;

  const [platform, setPlatform] = useState<HealthPlatform>(
    initState.isInitialized ? initState.platform : 'unavailable'
  );
  const [isReady, setIsReady] = useState(preInitialized);
  const [isLoading, setIsLoading] = useState(!preInitialized && !hasCachedData);
  const [data, setData] = useState<HealthData>(cachedData ?? defaultHealthData);
  const [error, setError] = useState<string | null>(
    initState.isInitialized ? initState.error : null
  );
  const [lastUpdated, setLastUpdated] = useState<Date | null>(cachedLastUpdated);

  const platformRef = useRef<HealthPlatform>(
    initState.isInitialized ? initState.platform : 'unavailable'
  );
  const isReadyRef = useRef(preInitialized);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastFetchedAtRef = useRef<number>(useHealthDataStore.getState().lastFetchedAt ?? 0);
  const isSettingUpRef = useRef(false);

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (preInitialized) {
      // Already initialized during splash — skip setup, just load data
      loadData(initState.platform);
      startAutoRefresh();
    } else {
      // Fallback: run full setup if pre-init didn't happen (e.g. fresh install)
      setup();
    }
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
          // Already initialised — force refresh data (bypass staleness guard
          // since the user is returning to the app and expects fresh data)
          lastFetchedAtRef.current = 0;
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
    if (isSettingUpRef.current) return;
    isSettingUpRef.current = true;
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
      isSettingUpRef.current = false;
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

      // Persist to MMKV store for cache hydration on next launch
      useHealthDataStore.getState().setData(result);
      useHealthDataStore.getState().setLastFetchedAt(Date.now());
      lastFetchedAtRef.current = Date.now();
    } catch (e: any) {
      if (!silent) setError(e?.message ?? 'Failed to load health data');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // ── Real-time step updates from native sensor ─────────────────────────────
  // Subscribe to native step events so coins update immediately as the user walks,
  // without waiting for the 60s full-data poll.
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    (async () => {
      const { stepService } = await import('../../../services/stepService');
      if (stepService.getSource() === 'native_sensor') {
        unsubscribe = stepService.onStepUpdate((newSteps: number) => {
          setData(prev => {
            if (prev.steps === newSteps) return prev;
            return { ...prev, steps: newSteps };
          });
          setLastUpdated(new Date());
        });
      }
    })();

    return () => { unsubscribe?.(); };
  }, []);

  // ── Manual refresh ────────────────────────────────────────────────────────
  const refresh = useCallback(
    (silent: boolean = false) => {
      if (!isReadyRef.current) return;
      // Staleness guard: skip fetch if data is fresh and this is a silent refresh.
      // Use a shorter threshold (5s) to prevent stale data on app foreground,
      // while still deduplicating rapid successive calls.
      const threshold = silent ? 5_000 : 0;
      if (silent && Date.now() - lastFetchedAtRef.current < threshold) {
        return;
      }
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
    writeSteps,
    writeWeight,
    writeHydration,
  };
}
