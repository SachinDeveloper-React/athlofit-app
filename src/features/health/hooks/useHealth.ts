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

// Health Connect is Android-only — lazy-import to avoid crashing on iOS.
const getHealthConnectService = () =>
  require('../service/healthConnect.service') as typeof import('../service/healthConnect.service');

export type HealthPlatform = 'healthkit' | 'healthconnect' | 'native_sensor' | 'unavailable';

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
    // FIX #6: Reduced from 20s to 90s. Live step count is driven by the
    // native onStepUpdate event (fires every 5s) — see subscription below.
    // This interval only refreshes full health data (vitals, hydration, etc.)
    // which don't change as frequently and are expensive to read from HC/HK.
    refreshInterval = 90_000,
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
    initState.isInitialized && initState.isReady ? initState.error : null
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
    // FIX #9: Eagerly clear any stale step offset from a previous day.
    // This prevents yesterday's offset from briefly inflating today's count
    // before the server fetch completes.
    import('../service/stepOffset.service').then(({ clearStaleStepOffset }) => {
      clearStaleStepOffset();
    });

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

  // ── Midnight reset: force-refresh health data when the day changes ────────
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 1, 0); // 1 second past midnight
    const msUntilMidnight = midnight.getTime() - now.getTime();

    const timer = setTimeout(async () => {
      // Reset cached data to zero immediately so the UI doesn't show stale steps
      const freshData = { ...defaultHealthData };
      setData(freshData);
      setLastUpdated(new Date());
      useHealthDataStore.getState().setData(freshData);

      // Clear the synced step offset — it was for yesterday
      useHealthDataStore.getState().setSyncedStepOffset(0, '');

      // Clear the server baseline — it was for yesterday
      useHealthDataStore.getState().setSyncedServerBaseline(null, '');

      // Trigger native service midnight reset (resets notification + widget)
      // This ensures reset even if AlarmManager alarm was delayed by Doze
      if (Platform.OS === 'android') {
        const { stepService } = await import('../../../services/stepService');
        stepService.triggerMidnightReset();
      }

      if (isReadyRef.current) {
        // Force a fresh fetch — bypass staleness guard so new day's data loads
        lastFetchedAtRef.current = 0;
        // Small delay to allow native service and Health Connect to reset
        setTimeout(() => {
          loadData(platformRef.current);
        }, 3000);
      }
    }, msUntilMidnight);

    return () => clearTimeout(timer);
  }, []);

  // ── Auto-refresh timer ────────────────────────────────────────────────────
  // Track the date we're on — used to detect day change during polling
  const currentDateRef = useRef<string>(new Date().toISOString().split('T')[0]);

  const startAutoRefresh = useCallback(() => {
    if (refreshInterval <= 0) return;
    stopAutoRefresh();
    intervalRef.current = setInterval(() => {
      // Detect day change during polling (backup for midnight timer)
      const today = new Date().toISOString().split('T')[0];
      if (today !== currentDateRef.current) {
        currentDateRef.current = today;
        // Day changed — reset data to 0 and force fresh fetch
        const freshData = { ...defaultHealthData };
        setData(freshData);
        useHealthDataStore.getState().setData(freshData);
        useHealthDataStore.getState().setSyncedStepOffset(0, '');
        useHealthDataStore.getState().setSyncedServerBaseline(null, '');
        lastFetchedAtRef.current = 0;
      }
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
      // Check if user previously chose native-sensor-only mode
      const { getHealthPreference } = await import('../service/healthPreference.service');
      const pref = getHealthPreference();

      if (pref === 'skipped') {
        // User chose to skip health platform — use native sensor only
        const { stepService } = await import('../../../services/stepService');
        await stepService.initialize();
        platformRef.current = 'native_sensor';
        setPlatform('native_sensor');
        isReadyRef.current = true;
        setIsReady(true);
        await loadData('native_sensor');
        startAutoRefresh();
        return;
      }

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
        const { isHealthConnectAvailable, initializeHealthConnect } = getHealthConnectService();
        const available = await isHealthConnectAvailable();
        if (!available) {
          // Start native step service in background but show permission screen
          const { stepService } = await import('../../../services/stepService');
          await stepService.initialize();
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
          // Health Connect permission denied — start native step service in the
          // background for basic step counting, but keep platform as 'unavailable'
          // so the PermissionDeniedScreen renders and the user can grant access or skip.
          const { stepService } = await import('../../../services/stepService');
          await stepService.initialize();
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
      // Wait for the step offset fetch to complete (max 3s) so we don't show
      // 0 steps on fresh install/reinstall while the server fetch is in-flight.
      // This solves the race condition where loadData runs before setAuth's
      // fetchAndStoreTodayStepOffset has finished writing the offset to store.
      if (!useHealthDataStore.getState().stepOffsetFetched) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 3000); // Don't block more than 3s
          const unsubscribe = useHealthDataStore.subscribe((state) => {
            if (state.stepOffsetFetched) {
              clearTimeout(timeout);
              unsubscribe();
              resolve();
            }
          });
          // Re-check in case it was set between the if-check and subscribe
          if (useHealthDataStore.getState().stepOffsetFetched) {
            clearTimeout(timeout);
            unsubscribe();
            resolve();
          }
        });
      }

      let result: HealthData;
      if (p === 'healthkit') {
        result = await fetchAllHealthKitData();
      } else if (p === 'native_sensor') {
        // Native sensor only — get steps and derive other metrics
        const { stepService } = await import('../../../services/stepService');
        const nativeSensorSteps = await stepService.getCurrentSteps();

        // Add synced step offset from server (cross-device continuity).
        // If the user walked on another device today, those steps carry over.
        const { syncedStepOffset, syncedStepOffsetDate } = useHealthDataStore.getState();
        const today = new Date().toISOString().split('T')[0];
        const offset = syncedStepOffsetDate === today ? syncedStepOffset : 0;
        const steps = nativeSensorSteps + offset;

        const STEPS_PER_MINUTE = 100;
        const STEP_LENGTH_KM = 0.76 / 1000; // average step length ~0.76m
        const CAL_PER_STEP = (weightKg * 0.57) / 1000; // rough calorie derivation

        result = {
          ...defaultHealthData,
          steps,
          calories: Math.round(steps * CAL_PER_STEP),
          distance: Math.round(steps * STEP_LENGTH_KM * 100) / 100,
          activeMinutes: Math.round(steps / STEPS_PER_MINUTE),
        };

        // Apply server baseline for all metrics (cross-device / reinstall continuity).
        // Use max(local, server) so we never lose data that was already synced.
        const { syncedServerBaseline, syncedServerBaselineDate } = useHealthDataStore.getState();
        if (syncedServerBaseline && syncedServerBaselineDate === today) {
          result = {
            steps: Math.max(result.steps, syncedServerBaseline.steps),
            calories: Math.max(result.calories, syncedServerBaseline.calories),
            distance: Math.max(result.distance, syncedServerBaseline.distance),
            activeMinutes: Math.max(result.activeMinutes, syncedServerBaseline.activeMinutes),
            heartRate: syncedServerBaseline.heartRate || result.heartRate,
            heartRateMin: syncedServerBaseline.heartRateMin || result.heartRateMin,
            heartRateMax: syncedServerBaseline.heartRateMax || result.heartRateMax,
            bloodPressureSystolic: syncedServerBaseline.bloodPressureSystolic || result.bloodPressureSystolic,
            bloodPressureDiastolic: syncedServerBaseline.bloodPressureDiastolic || result.bloodPressureDiastolic,
            sleepHours: Math.max(result.sleepHours, syncedServerBaseline.sleepHours),
            weight: syncedServerBaseline.weight || result.weight,
            bloodGlucose: syncedServerBaseline.bloodGlucose || result.bloodGlucose,
            hydration: Math.max(result.hydration, syncedServerBaseline.hydration),
          };
        }
      } else {
        // Health Connect path
        const loginTimestamp = useHealthDataStore.getState().loginTimestamp;
        const { fetchAllHealthConnectData } = getHealthConnectService();
        result = await fetchAllHealthConnectData(weightKg, loginTimestamp);

        // Overlay native step counter's live value for real-time accuracy.
        // Take the higher of HC and native sensor — the native service may have
        // just restarted (showing 0 or a low value) while HC has accumulated
        // steps from before the service was running.
        const { stepService } = await import('../../../services/stepService');
        const nativeSteps = await stepService.getCurrentSteps();
        if (nativeSteps > result.steps) {
          result = { ...result, steps: nativeSteps };
        }

        // Apply server baseline for all metrics (cross-device / reinstall continuity).
        // After reinstall, loginTimestamp filters out pre-login HC data, but the
        // server has the user's health data for today. Use max(local, server) to restore.
        const { syncedServerBaseline, syncedServerBaselineDate } = useHealthDataStore.getState();
        const today = new Date().toISOString().split('T')[0];
        if (syncedServerBaseline && syncedServerBaselineDate === today) {
          result = {
            steps: Math.max(result.steps, syncedServerBaseline.steps),
            calories: Math.max(result.calories, syncedServerBaseline.calories),
            distance: Math.max(result.distance, syncedServerBaseline.distance),
            activeMinutes: Math.max(result.activeMinutes, syncedServerBaseline.activeMinutes),
            heartRate: result.heartRate || syncedServerBaseline.heartRate,
            heartRateMin: result.heartRateMin || syncedServerBaseline.heartRateMin,
            heartRateMax: result.heartRateMax || syncedServerBaseline.heartRateMax,
            bloodPressureSystolic: result.bloodPressureSystolic || syncedServerBaseline.bloodPressureSystolic,
            bloodPressureDiastolic: result.bloodPressureDiastolic || syncedServerBaseline.bloodPressureDiastolic,
            sleepHours: Math.max(result.sleepHours, syncedServerBaseline.sleepHours),
            weight: result.weight || syncedServerBaseline.weight,
            bloodGlucose: result.bloodGlucose || syncedServerBaseline.bloodGlucose,
            hydration: Math.max(result.hydration, syncedServerBaseline.hydration),
          };
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
  // Subscribe to native step events so the UI updates immediately as the user
  // walks. The native sensor service runs on all API levels now.
  // Adds the synced step offset for cross-device continuity.
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    (async () => {
      const { stepService } = await import('../../../services/stepService');
      unsubscribe = stepService.onStepUpdate((newSteps: number) => {
        // Add synced offset from server (steps from previous device today)
        // Only for native_sensor mode — HC/HK handle their own step totals.
        let totalSteps = newSteps;
        if (platformRef.current === 'native_sensor') {
          const { syncedStepOffset, syncedStepOffsetDate, syncedServerBaseline, syncedServerBaselineDate } = useHealthDataStore.getState();
          const today = new Date().toISOString().split('T')[0];
          const offset = syncedStepOffsetDate === today ? syncedStepOffset : 0;
          totalSteps = newSteps + offset;

          // Ensure steps never drop below the server baseline (reinstall continuity)
          if (syncedServerBaseline && syncedServerBaselineDate === today) {
            totalSteps = Math.max(totalSteps, syncedServerBaseline.steps);
          }
        }

        setData(prev => {
          if (prev.steps === totalSteps) return prev;
          // In healthconnect/healthkit mode, the native sensor is a supplementary
          // source for real-time updates. Never let it decrease the step count
          // below what Health Connect already reported — this prevents the service
          // from overwriting HC steps with 0 when it restarts after being stopped.
          if (platformRef.current !== 'native_sensor' && totalSteps < prev.steps) {
            return prev;
          }
          return { ...prev, steps: totalSteps };
        });
        setLastUpdated(new Date());
      });
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

  // ── Retry setup (after permissions granted from PermissionDeniedScreen) ───
  const retrySetup = useCallback(async () => {
    // Clear any stored "skipped" preference so the full flow runs
    const { clearHealthPreference } = await import('../service/healthPreference.service');
    clearHealthPreference();
    // Reset the guard so setup() can run again
    isSettingUpRef.current = false;
    // Also reset healthInitStore so it doesn't short-circuit
    useHealthInitStore.getState().reset();
    setup();
  }, []);

  // ── Skip to native sensor (user chose to continue without HC/HK) ─────────
  const skipToNativeSensor = useCallback(async () => {
    const { setHealthPreference } = await import('../service/healthPreference.service');
    setHealthPreference('skipped');

    // Initialize native step service
    const { stepService } = await import('../../../services/stepService');
    await stepService.initialize();

    // Update state to native_sensor mode
    platformRef.current = 'native_sensor';
    setPlatform('native_sensor');
    isReadyRef.current = true;
    setIsReady(true);
    setError(null);

    // Update the init store so it stays consistent
    useHealthInitStore.getState().skipToNativeSensor();

    // Load data using native sensor
    await loadData('native_sensor');
    startAutoRefresh();
  }, []);

  // ── Manual log methods — routed by platform ───────────────────────────────

  const logHeartRate = useCallback(
    async (bpm: number) => {
      if (platform === 'healthkit') await writeHeartRateHK(bpm);
      else if (platform === 'healthconnect') {
        const { writeHeartRateHC } = getHealthConnectService();
        await writeHeartRateHC(bpm);
      }
      // native_sensor: no external write — just update local state
      setData(prev => ({ ...prev, heartRate: bpm }));
      setLastUpdated(new Date());
    },
    [platform],
  );

  const logBloodPressure = useCallback(
    async (systolic: number, diastolic: number) => {
      if (platform === 'healthkit')
        await writeBloodPressureHK(systolic, diastolic);
      else if (platform === 'healthconnect') {
        const { writeBloodPressureHC } = getHealthConnectService();
        await writeBloodPressureHC(systolic, diastolic);
      }
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
      else if (platform === 'healthconnect') {
        const { writeWeightHC } = getHealthConnectService();
        await writeWeightHC(kg, new Date());
      }
      setData(prev => ({ ...prev, weight: kg }));
      setLastUpdated(new Date());
    },
    [platform],
  );

  // ── Legacy step / weight / hydration write ────────────────────────────────

  const writeSteps = useCallback(
    async (count: number, start: Date, end: Date) => {
      if (platform === 'healthkit') await writeStepsHK(count, start);
      else if (platform === 'healthconnect') {
        const { writeStepsHC } = getHealthConnectService();
        await writeStepsHC(count, start, end);
      }
    },
    [platform],
  );

  const writeWeight = useCallback(
    async (kg: number, date: Date) => {
      if (platform === 'healthkit') await writeWeightHK(kg, date);
      else if (platform === 'healthconnect') {
        const { writeWeightHC } = getHealthConnectService();
        await writeWeightHC(kg, date);
      }
    },
    [platform],
  );

  const writeHydration = useCallback(
    async (ml: number, start: Date, end: Date) => {
      if (platform === 'healthkit') await writeHydrationHK(ml, start);
      else if (platform === 'healthconnect') {
        const { writeHydrationHC } = getHealthConnectService();
        await writeHydrationHC(ml, start, end);
      }
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
    retrySetup,
    skipToNativeSensor,
    logHeartRate,
    logBloodPressure,
    logWeight,
    writeSteps,
    writeWeight,
    writeHydration,
  };
}
