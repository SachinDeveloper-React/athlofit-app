import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { HealthData, defaultHealthData } from '../types/healthTypes';
import { useHealthDataStore } from '../store/healthDataStore';
import { useHealthInitStore } from '../store/healthInitStore';
import { useAuthStore } from '../../auth/store/authStore';
import { getLocalToday } from '../../../utils/date';

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
  /** User gender for stride-based distance calculation. 'M'=0.78m, 'F'=0.70m. */
  gender?: 'M' | 'F' | 'O' | null;
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
    gender,
  } = options;

  // ── Cache hydration from MMKV store ──────────────────────────────────────
  // Check if cached data is from today. If it's from a previous day, discard it
  // immediately to prevent yesterday's steps from showing on a new day when
  // the app opens after being killed overnight (missed midnight reset).
  const storeState = useHealthDataStore.getState();
  const cachedLastFetchedAt = storeState.lastFetchedAt;
  const isCacheFromToday = (() => {
    if (!cachedLastFetchedAt) return false;
    const fetchDate = new Date(cachedLastFetchedAt);
    const today = new Date();
    return (
      fetchDate.getFullYear() === today.getFullYear() &&
      fetchDate.getMonth() === today.getMonth() &&
      fetchDate.getDate() === today.getDate()
    );
  })();

  const cachedData = isCacheFromToday ? storeState.data : defaultHealthData;
  const cachedLastUpdated = isCacheFromToday ? storeState.lastUpdated : null;
  const hasCachedData = isCacheFromToday && cachedData !== null && cachedData !== defaultHealthData;

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

  // ── HC floor tracking for real-time native increments ─────────────────────
  // When loadData runs (every 90s), HC may report steps from external sources
  // (watch, other device) that the phone's native sensor doesn't know about.
  // We track the last loadData result so onStepUpdate can apply native sensor
  // increments ON TOP of the HC value instead of getting blocked.
  // Initialize from cached data so the "never decrease" guard works on first loadData.
  const lastLoadDataStepsRef = useRef<number>(cachedData?.steps ?? 0);
  // Track the last raw native value received by onStepUpdate, so we can
  // compute the delta (increment) between consecutive native events.
  const lastRawNativeRef = useRef<number>(0);

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    // FIX #9: Eagerly clear any stale step offset from a previous day.
    // This prevents yesterday's offset from briefly inflating today's count
    // before the server fetch completes.
    import('../service/stepOffset.service').then(({ clearStaleStepOffset }) => {
      clearStaleStepOffset();
    });

    // If cached data was from a previous day, clear the persisted store now
    // so stale steps never leak into the new day's display.
    if (!isCacheFromToday) {
      useHealthDataStore.getState().setData(defaultHealthData);

      // Only clear step offset / server baseline if they are stale (from a
      // previous day). After a fresh login, fetchAndStoreTodayStepOffset may
      // have ALREADY stored today's baseline before this component mounts.
      // Unconditionally wiping it caused distance/calories/activeMinutes to
      // show 0 after re-login because the baseline (the only source of
      // pre-login values) was destroyed before loadData could read it.
      const today = getLocalToday();
      const { syncedStepOffsetDate, syncedServerBaselineDate, bonusStepsDate } =
        useHealthDataStore.getState();
      if (syncedStepOffsetDate !== today) {
        useHealthDataStore.getState().setSyncedStepOffset(0, '');
      }
      if (syncedServerBaselineDate !== today) {
        useHealthDataStore.getState().setSyncedServerBaseline(null, '');
      }
      if (bonusStepsDate !== today) {
        useHealthDataStore.getState().setBonusSteps(0, '');
      }

      // If the step offset fetch hasn't completed yet (login flow in progress),
      // keep the flag as-is so loadData waits for it. If it already completed
      // (baseline is stored for today), leave it as true so loadData proceeds
      // immediately without an unnecessary 3-second wait.
    }

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
  // Track the last known date for AppState-based day-change detection
  const lastKnownDateRef = useRef<string>(getLocalToday());
  // Track the date we're on — used to detect day change during polling
  const currentDateRef = useRef<string>(getLocalToday());
  // Track when midnight reset occurred — native sensor events are ignored for
  // a brief window after reset to prevent stale yesterday's count from leaking.
  const midnightResetAtRef = useRef<number>(0);
  // ── Midnight reset gate ────────────────────────────────────────────────────
  // After midnight reset, ALL step updates are blocked until the native sensor
  // confirms it has properly reset (reports 0 or a very low count < 50).
  // This guarantees: first show 0, then only forward real new-day steps.
  const midnightResetPendingRef = useRef<boolean>(false);

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
        // ── Day-change guard: reset step data immediately if the day changed
        // while the app was in the background. Covers phones where the midnight
        // alarm was delayed/skipped by Doze or OEM battery optimizations.
        const today = getLocalToday();
        if (today !== lastKnownDateRef.current) {
          lastKnownDateRef.current = today;
          currentDateRef.current = today;
          if (Platform.OS === 'android') {
            midnightResetPendingRef.current = true; // Gate: block stale step updates
          }
          const freshData = { ...defaultHealthData };
          setData(freshData);
          setLastUpdated(new Date());
          useHealthDataStore.getState().setData(freshData);
          useHealthDataStore.getState().setSyncedStepOffset(0, '');
          useHealthDataStore.getState().setSyncedServerBaseline(null, '');
          lastFetchedAtRef.current = 0;
          lastRawNativeRef.current = 0;
          lastLoadDataStepsRef.current = 0;

          // Trigger native midnight reset in case the native alarm was also missed
          if (Platform.OS === 'android') {
            import('../../../services/stepService').then(({ stepService }) => {
              stepService.triggerMidnightReset();
            });
          }
        }

        // ── FIX Issue 2a: Auto-open midnight reset gate on resume ──────────
        // If the gate has been pending for > 2 minutes, the safety timeout
        // likely fired while the app was backgrounded (JS timers are unreliable
        // in background). Open the gate now so steps aren't stuck at 0.
        if (Platform.OS === 'android' && midnightResetPendingRef.current) {
          const msSinceReset = Date.now() - midnightResetAtRef.current;
          if (msSinceReset > 2 * 60_000) {
            console.warn('[useHealth] Midnight gate auto-opened on resume (pending > 2min)');
            midnightResetPendingRef.current = false;
          }
        }

        // ── FIX Issue 2b: Restart native step service if killed ────────────
        // Some OEM ROMs aggressively kill foreground services. On resume,
        // always call start() — it's a no-op if already running, but will
        // restart the service if it was killed in the background.
        if (Platform.OS === 'android') {
          import('../../../services/stepService').then(({ stepService }) => {
            stepService.start().catch(() => {});
          });
        }

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
  // Uses a state counter to re-trigger this effect after each midnight fires,
  // ensuring multi-day sessions continuously schedule the next midnight reset.
  const [midnightResetCount, setMidnightResetCount] = useState(0);

  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 0, 0); // exactly 12:00:00.000 AM
    const msUntilMidnight = midnight.getTime() - now.getTime();

    const timer = setTimeout(async () => {
      // Reset cached data to zero INSTANTLY so the UI shows 0 at midnight
      const freshData = { ...defaultHealthData };
      setData(freshData);
      setLastUpdated(new Date());
      useHealthDataStore.getState().setData(freshData);
      lastRawNativeRef.current = 0;
      lastLoadDataStepsRef.current = 0;

      // Clear the synced step offset — it was for yesterday
      useHealthDataStore.getState().setSyncedStepOffset(0, '');

      // Clear the server baseline — it was for yesterday
      useHealthDataStore.getState().setSyncedServerBaseline(null, '');

      // Clear Health Connect step cache to prevent stale yesterday's steps
      // from being served on the next read after midnight
      if (Platform.OS === 'android') {
        const { resetStepCache } = require('../service/healthConnect.service');
        resetStepCache();
      }

      // Update day tracking refs
      const today = getLocalToday();
      lastKnownDateRef.current = today;
      currentDateRef.current = today;
      midnightResetAtRef.current = Date.now();
      // Gate only on Android — iOS HealthKit handles day boundaries correctly
      // and has no native step sensor to confirm reset.
      if (Platform.OS === 'android') {
        midnightResetPendingRef.current = true; // Gate: block all step updates until reset confirmed
      }

      // Safety timeout: if native sensor doesn't confirm reset within 2 minutes,
      // auto-open the gate. This handles edge cases where the sensor service
      // crashes or stops sending events after midnight.
      setTimeout(() => {
        if (midnightResetPendingRef.current) {
          console.warn('[useHealth] Midnight reset gate auto-opened after 2min timeout');
          midnightResetPendingRef.current = false;
        }
      }, 2 * 60_000);

      // Trigger native service midnight reset (resets notification + widget)
      if (Platform.OS === 'android') {
        const { stepService } = await import('../../../services/stepService');
        await stepService.triggerMidnightReset();
        // Give the native sensor service time to fully reset its counter
        // before we read from it again. Without this delay, getCurrentSteps()
        // returns yesterday's accumulated count.
        await new Promise<void>(r => setTimeout(r, 1000));
      }

      if (isReadyRef.current) {
        // Force a fresh fetch immediately — no delay, load today's data now
        lastFetchedAtRef.current = 0;
        loadData(platformRef.current);
      }

      // Re-trigger this effect to schedule the next midnight reset
      setMidnightResetCount(c => c + 1);
    }, msUntilMidnight);

    return () => clearTimeout(timer);
  }, [midnightResetCount]);

  // ── Precision midnight guard ────────────────────────────────────────────────
  // Polls every 500ms during the last 10 seconds before midnight to guarantee
  // an instant reset at 12:00:00 AM even if setTimeout drifts due to JS event
  // loop delays or Android Doze batching.
  useEffect(() => {
    const TEN_SECONDS = 10_000;
    const POLL_MS = 500;

    const schedulePrecisionGuard = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setDate(midnight.getDate() + 1);
      midnight.setHours(0, 0, 0, 0);
      const msUntilGuardStart = midnight.getTime() - now.getTime() - TEN_SECONDS;

      // If we're already within 10s of midnight, start polling immediately
      const delay = Math.max(0, msUntilGuardStart);

      return setTimeout(() => {
        const poller = setInterval(() => {
          const today = getLocalToday();
          if (today !== currentDateRef.current) {
            clearInterval(poller);
            // Day changed — perform instant reset
            currentDateRef.current = today;
            lastKnownDateRef.current = today;
            if (Platform.OS === 'android') {
              midnightResetPendingRef.current = true; // Gate: block stale step updates
            }
            const freshData = { ...defaultHealthData };
            setData(freshData);
            setLastUpdated(new Date());
            useHealthDataStore.getState().setData(freshData);
            useHealthDataStore.getState().setSyncedStepOffset(0, '');
            useHealthDataStore.getState().setSyncedServerBaseline(null, '');
            lastFetchedAtRef.current = 0;

            if (isReadyRef.current) {
              loadData(platformRef.current);
            }
          }
        }, POLL_MS);

        // Stop the poller after 30s (midnight should have passed by then)
        setTimeout(() => clearInterval(poller), 30_000);
      }, delay);
    };

    const guardTimer = schedulePrecisionGuard();
    return () => clearTimeout(guardTimer);
  }, [midnightResetCount]);

  // ── Auto-refresh timer ────────────────────────────────────────────────────
  const startAutoRefresh = useCallback(() => {
    if (refreshInterval <= 0) return;
    stopAutoRefresh();
    intervalRef.current = setInterval(() => {
      // Detect day change during polling (backup for midnight timer)
      const today = getLocalToday();
      if (today !== currentDateRef.current) {
        currentDateRef.current = today;
        if (Platform.OS === 'android') {
          midnightResetPendingRef.current = true; // Gate: block stale step updates
        }
        // Day changed — reset data to 0 and force fresh fetch
        const freshData = { ...defaultHealthData };
        setData(freshData);
        setLastUpdated(new Date());
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
        const loginTimestamp = useHealthDataStore.getState().loginTimestamp;
        const accountCreatedAt = useAuthStore.getState().user?.createdAt ?? null;
        result = await fetchAllHealthKitData(loginTimestamp, accountCreatedAt);

        // Apply server baseline for cross-device / reinstall continuity (iOS).
        // Since we now read HealthKit from loginTimestamp, pre-login steps are
        // only available from the server baseline.
        const { syncedServerBaseline, syncedServerBaselineDate } = useHealthDataStore.getState();
        const today = getLocalToday();
        if (syncedServerBaseline && syncedServerBaselineDate === today) {
          // If login was today, HK steps are post-login only — add server baseline.
          // If login was yesterday, HK returns full day — use max.
          const loginTs = useHealthDataStore.getState().loginTimestamp;
          const isLoginToday = loginTs ? (() => {
            const ld = new Date(loginTs);
            const now = new Date();
            return ld.getFullYear() === now.getFullYear() &&
                   ld.getMonth() === now.getMonth() &&
                   ld.getDate() === now.getDate();
          })() : false;

          // FIX: Additive mode should ONLY apply within the first 10 minutes after login.
          // After that window, the server has already synced the post-login steps and
          // the server baseline includes them. Using additive mode after the first sync
          // creates circular inflation: HK post-login steps + server baseline (which
          // already contains those steps) = 2x inflation.
          const isRecentLogin = loginTs ? (Date.now() - loginTs < 10 * 60_000) : false;

          // FIX: Skip inflation guard when login was RECENT — HK only has
          // post-login steps so server being > 2x local is EXPECTED.
          const serverStepsTrusted = (
            !isRecentLogin && result.steps > 100 && syncedServerBaseline.steps > result.steps * 2
          ) ? result.steps : syncedServerBaseline.steps;

          if (serverStepsTrusted !== syncedServerBaseline.steps) {
            console.warn(
              `[useHealth] Inflation guard (healthkit): server baseline ${syncedServerBaseline.steps} is ` +
              `${(syncedServerBaseline.steps / result.steps).toFixed(1)}x local ${result.steps} — ignoring server steps`
            );
            useHealthDataStore.getState().setSyncedServerBaseline(null, '');
          }

          // Heuristic: If HK returns steps >= 80% of server baseline, HK likely
          // has full-day data (time filter not effective). Use max() to avoid
          // doubling. If HK steps are much less, HK has only post-login data → additive.
          const hkHasFullDay = isLoginToday && serverStepsTrusted > 0
            && result.steps >= serverStepsTrusted * 0.8;
          // CRITICAL FIX: Only use additive mode if login was RECENT (< 10 min ago).
          const useAdditive = isLoginToday && isRecentLogin && !hkHasFullDay;

          const combinedSteps = useAdditive
            ? serverStepsTrusted + result.steps
            : Math.max(result.steps, serverStepsTrusted);

          // When using additive mode (HK only has post-login data), distance,
          // calories, and activeMinutes must also be additive so they increment.
          // When HK has full-day data, Math.max ensures no doubling.
          const combinedCalories = useAdditive
            ? syncedServerBaseline.calories + result.calories
            : Math.max(result.calories, syncedServerBaseline.calories);
          const combinedDistance = useAdditive
            ? Math.round((syncedServerBaseline.distance + result.distance) * 100) / 100
            : Math.max(result.distance, syncedServerBaseline.distance);
          const combinedActiveMinutes = useAdditive
            ? syncedServerBaseline.activeMinutes + result.activeMinutes
            : Math.max(result.activeMinutes, syncedServerBaseline.activeMinutes);

          result = {
            steps: combinedSteps,
            calories: combinedCalories,
            distance: combinedDistance,
            activeMinutes: combinedActiveMinutes,
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
      } else if (p === 'native_sensor') {
        // Native sensor only — get steps and derive other metrics
        const { stepService } = await import('../../../services/stepService');
        const nativeSensorSteps = await stepService.getCurrentSteps();

        // Check if this reading can confirm the midnight gate is resolved
        if (midnightResetPendingRef.current && nativeSensorSteps <= 50) {
          midnightResetPendingRef.current = false;
          console.log(`[useHealth] loadData (native_sensor): Midnight reset confirmed at ${nativeSensorSteps}`);
        }

        // FIX: Also read from Health Connect as a fallback when in native_sensor mode.
        // On devices where the native sensor dies (OEM killing), HC (fed by GMS) is
        // the only source that keeps counting. Use max(native, HC) so steps never
        // appear stuck even when the hardware sensor is dead.
        let hcFallbackSteps = 0;
        if (Platform.OS === 'android') {
          try {
            const { readRecords } = await import('react-native-health-connect');
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const now = new Date();
            const { records } = await readRecords('Steps', {
              timeRangeFilter: {
                operator: 'between' as const,
                startTime: startOfDay.toISOString(),
                endTime: now.toISOString(),
              },
            });
            if (records && records.length > 0) {
              const OWN_PACKAGE = 'com.athlofit.athlofit';
              const totals: Record<string, number> = {};
              for (const r of records) {
                const origin = (r as any).metadata?.dataOrigin ?? 'unknown';
                if (origin === OWN_PACKAGE) continue;
                totals[origin] = (totals[origin] ?? 0) + ((r as any).count ?? 0);
              }
              hcFallbackSteps = Object.values(totals).length > 0
                ? Math.max(...Object.values(totals))
                : 0;
            }
          } catch (e) {
            // HC not available or read failed — continue with native only
          }
        }

        // Use the higher of native sensor and HC fallback
        const effectiveSteps = Math.max(nativeSensorSteps, hcFallbackSteps);

        // DEPRECATED: Step offset logic removed.
        // Previously, syncedStepOffset was added to native sensor steps to provide
        // cross-device continuity (steps from another device carried over on login).
        // However, this created circular inflation:
        //   1. Device A syncs 5000 steps → server stores 5000
        //   2. Device B logs in → fetches server baseline (5000) as step offset
        //   3. Device B native sensor shows 100 steps → offset applied → total 5100
        //   4. Device B syncs 5100 → server updates to 5100
        //   5. Device B re-fetches baseline → offset becomes 5100
        //   6. Next native reading: 200 + 5100 = 5300 → INFLATION LOOP
        //
        // FIX: Use server baseline as a FLOOR (max), NOT an additive offset.
        // This is handled below in the "Apply server baseline" section.
        const steps = effectiveSteps;
        const today = getLocalToday(); // YYYY-MM-DD format for date comparison

        const STEPS_PER_MINUTE = 100;
        const STRIDE_M = gender === 'F' ? 0.70 : 0.78; // gender-based stride
        const STEP_LENGTH_KM = STRIDE_M / 1000;
        const CAL_PER_STEP = (weightKg * 0.57) / 1000; // rough calorie derivation

        result = {
          ...defaultHealthData,
          steps,
          calories: Math.round(steps * CAL_PER_STEP),
          distance: Math.round(steps * STEP_LENGTH_KM * 100) / 100,
          activeMinutes: Math.round(steps / STEPS_PER_MINUTE),
        };

        // Apply server baseline for all metrics (cross-device / reinstall continuity).
        // CRITICAL: Server baseline is a FLOOR (minimum value), NOT an additive offset.
        // Use max(local, server) to ensure steps never drop below the server's last
        // known value, but NEVER add server steps on top of local steps.
        // The server baseline already represents the device's actual step count from
        // the previous sync — adding it again would cause circular inflation.
        const { syncedServerBaseline, syncedServerBaselineDate } = useHealthDataStore.getState();
        if (syncedServerBaseline && syncedServerBaselineDate === today) {
          // FIX: Inflation guard — if server baseline steps are more than 2x
          // the local native sensor result, the server likely has inflated data
          // from the previous circular bug. Reject it to prevent further inflation.
          const serverStepsTrusted = (
            result.steps > 100 && syncedServerBaseline.steps > result.steps * 2
          ) ? result.steps : syncedServerBaseline.steps;

          if (serverStepsTrusted !== syncedServerBaseline.steps) {
            console.warn(
              `[useHealth] Inflation guard (native_sensor): server baseline ${syncedServerBaseline.steps} is ` +
              `${(syncedServerBaseline.steps / result.steps).toFixed(1)}x local ${result.steps} — ignoring server steps`
            );
            // Clear the inflated baseline immediately so it doesn't persist
            useHealthDataStore.getState().setSyncedServerBaseline(null, '');
          }

          // Use MAX (floor logic), NOT ADD (which causes circular inflation)
          result = {
            steps: Math.max(result.steps, serverStepsTrusted),
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
        const accountCreatedAt = useAuthStore.getState().user?.createdAt ?? null;
        result = await fetchAllHealthConnectData(weightKg, loginTimestamp, gender, accountCreatedAt);

        // Overlay native step counter's live value for real-time accuracy.
        // Take the higher of HC and native sensor — the native service may have
        // just restarted (showing 0 or a low value) while HC has accumulated
        // steps from before the service was running.
        // GUARD: If midnight reset is pending (gate closed), don't trust native
        // sensor — it may still report yesterday's count. Wait for reset confirmation.
        const { stepService } = await import('../../../services/stepService');
        const nativeSteps = await stepService.getCurrentSteps();

        // Determine if login was today — needed for native overlay decision.
        const loginTsForOverlay = useHealthDataStore.getState().loginTimestamp;
        const isLoginTodayForOverlay = loginTsForOverlay ? (() => {
          const ld = new Date(loginTsForOverlay);
          const now = new Date();
          return ld.getFullYear() === now.getFullYear() &&
                 ld.getMonth() === now.getMonth() &&
                 ld.getDate() === now.getDate();
        })() : false;

        // Check if server baseline exists for today (will be added later).
        const { syncedServerBaseline: baselineForOverlay, syncedServerBaselineDate: baselineDateForOverlay } = useHealthDataStore.getState();
        const hasServerBaselineToday = baselineForOverlay && baselineDateForOverlay === getLocalToday();

        if (midnightResetPendingRef.current) {
          if (nativeSteps <= 50) {
            // Native sensor confirmed reset — open the gate
            midnightResetPendingRef.current = false;
            console.log(`[useHealth] loadData: Midnight reset confirmed, native at ${nativeSteps}`);
            // Use native steps only if they're actually higher than HC
            if (nativeSteps > result.steps) {
              result = { ...result, steps: nativeSteps };
            }
          }
          // If gate is still pending (native > 50), don't overlay — keep HC value
        } else if (isLoginTodayForOverlay && hasServerBaselineToday) {
          // FIX: When login was today and we have a server baseline, DON'T overlay
          // the native sensor's all-day count onto HC's post-login-only count.
          // The native sensor reports total steps since midnight (including pre-login
          // steps that are already captured in the server baseline). If we overlay
          // native here and then ADD server baseline later, we'd double-count:
          //   native(3000, all-day) overlaid → result=3000
          //   server(12000) + result(3000) = 15000 ← WRONG (should be 12000 + post-login only)
          // Instead, keep HC's post-login-only steps and let the server baseline
          // additive logic handle the total correctly.
          // Only overlay if native is reporting MORE than the server baseline (genuinely new steps).
          const serverStepsForOverlay = baselineForOverlay?.steps ?? 0;
          if (nativeSteps > serverStepsForOverlay && nativeSteps > result.steps) {
            // Native has exceeded the server baseline — these are truly new steps
            // The total should be nativeSteps (which already includes pre+post login)
            // so replace HC result with native and switch to max mode below.
            result = { ...result, steps: nativeSteps };
          }
          // Otherwise, keep HC's post-login steps only — additive mode will add server baseline
        } else {
          // FIX: Detect inflated native sensor. If native is more than 2x HC,
          // the native service has a persisted inflated value from the old bug.
          // Correct it instead of using it.
          if (nativeSteps > result.steps) {
            if (result.steps > 100 && nativeSteps > result.steps * 2) {
              // Native is inflated — correct it to the HC value
              console.warn(
                `[useHealth] Native sensor inflated: ${nativeSteps} vs HC ${result.steps}. Correcting native.`
              );
              stepService.correctInflatedSteps(result.steps).catch(() => { /* non-fatal */ });
              // Don't use inflated native value — keep HC result
            } else {
              // Normal case: native is slightly ahead of HC (real-time sensor vs batch read)
              result = { ...result, steps: nativeSteps };
            }
          }
        }

        // Apply server baseline for all metrics (cross-device / reinstall continuity).
        // After login, loginTimestamp filters HC data to post-login steps only.
        // The server baseline has the user's cumulative steps for today (including
        // steps from before login). We ADD post-login steps to the server baseline
        // to get the correct total for the login day.
        // On subsequent days (loginTimestamp is yesterday), HC returns full-day
        // steps and server baseline is 0 or stale, so max() works correctly.
        const { syncedServerBaseline, syncedServerBaselineDate } = useHealthDataStore.getState();
        const today = getLocalToday();
        if (syncedServerBaseline && syncedServerBaselineDate === today) {
          // Determine if we're reading HC from loginTimestamp (login was today).
          // If so, HC steps are only post-login — add them to server baseline.
          // If not (login was yesterday / loginTimestamp null), HC has full day — use max.
          const loginTs = useHealthDataStore.getState().loginTimestamp;
          const isLoginToday = loginTs ? (() => {
            const ld = new Date(loginTs);
            const now = new Date();
            return ld.getFullYear() === now.getFullYear() &&
                   ld.getMonth() === now.getMonth() &&
                   ld.getDate() === now.getDate();
          })() : false;

          // FIX: Additive mode should ONLY apply within the first 10 minutes after login.
          // After that window, the server has already synced the post-login steps and
          // the server baseline includes them. Using additive mode after the first sync
          // creates circular inflation: HC post-login steps + server baseline (which
          // already contains those steps) = 2x inflation.
          // Time window: 10 minutes is generous enough to cover slow network / background
          // sync delays, but short enough to prevent inflation during normal app usage.
          const isRecentLogin = loginTs ? (Date.now() - loginTs < 10 * 60_000) : false;

          // FIX: Inflation guard — if server baseline steps are more than 2x
          // the local HC/native result, the server likely has inflated data from
          // the circular write bug. Don't use inflated server steps as a floor.
          // IMPORTANT: Skip the inflation guard when login was today, because
          // HC only has post-login steps (filtered by loginTimestamp) while the
          // server has the full day's steps. It's EXPECTED that server > 2x local
          // in this scenario (e.g., user walked 8000 steps, logged out, logged
          // back in — HC returns 1520 post-login steps, server has 8000).
          const serverStepsTrusted = (
            !isLoginToday && result.steps > 100 && syncedServerBaseline.steps > result.steps * 2
          ) ? result.steps : syncedServerBaseline.steps;

          if (serverStepsTrusted !== syncedServerBaseline.steps) {
            console.warn(
              `[useHealth] Inflation guard: server baseline ${syncedServerBaseline.steps} is ` +
              `${(syncedServerBaseline.steps / result.steps).toFixed(1)}x local ${result.steps} — ignoring server steps`
            );
            // Clear the inflated baseline so it doesn't persist
            useHealthDataStore.getState().setSyncedServerBaseline(null, '');
          }

          // Heuristic: If HC returns steps >= 80% of server baseline, HC likely
          // has full-day data (time filter not effective on this device/source).
          // Use max() to avoid doubling. If HC steps are much less than server,
          // HC genuinely has only post-login data → use additive.
          //
          // FIX: Use server's DEVICE steps (total - bonus) for the combination
          // calculation. The server baseline's `steps` field = device + bonus.
          // If we use the full value, bonus gets baked into data.steps, and
          // TrackerScreen adds bonusSteps again → double-counting.
          const { bonusSteps: storedBonus, bonusStepsDate } = useHealthDataStore.getState();
          const todayBonus = bonusStepsDate === today ? (storedBonus || 0) : 0;
          const serverDeviceSteps = Math.max(0, serverStepsTrusted - todayBonus);

          const hcHasFullDay = isLoginToday && serverDeviceSteps > 0
            && result.steps >= serverDeviceSteps * 0.8;
          // CRITICAL FIX: Only use additive mode if login was RECENT (< 10 min ago).
          // This prevents circular inflation when the app stays running for hours.
          const useAdditive = isLoginToday && isRecentLogin && !hcHasFullDay;

          const combinedSteps = useAdditive
            ? serverDeviceSteps + result.steps  // Server device steps (before login) + HC (after login)
            : Math.max(result.steps, serverDeviceSteps); // Full day or not login today — take max

          // When using additive mode (HC only has post-login data), distance,
          // calories, and activeMinutes must also be additive so they increment.
          // When HC has full-day data, Math.max ensures no doubling.
          const combinedCalories = useAdditive
            ? syncedServerBaseline.calories + result.calories
            : Math.max(result.calories, syncedServerBaseline.calories);
          const combinedDistance = useAdditive
            ? Math.round((syncedServerBaseline.distance + result.distance) * 100) / 100
            : Math.max(result.distance, syncedServerBaseline.distance);
          const combinedActiveMinutes = useAdditive
            ? syncedServerBaseline.activeMinutes + result.activeMinutes
            : Math.max(result.activeMinutes, syncedServerBaseline.activeMinutes);

          result = {
            steps: combinedSteps,
            calories: combinedCalories,
            distance: combinedDistance,
            activeMinutes: combinedActiveMinutes,
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

      // ── Final midnight gate ─────────────────────────────────────────────────
      // If midnight reset is still pending (native sensor hasn't confirmed reset),
      // force steps to 0 regardless of what HC or server baseline returned.
      // This guarantees: user sees 0 first, then only real new-day steps.
      if (midnightResetPendingRef.current && result.steps > 50) {
        console.log(`[useHealth] loadData: Gate pending, forcing steps from ${result.steps} to 0`);
        result = { ...result, steps: 0, calories: 0, distance: 0, activeMinutes: 0 };
      }

      // ── FIX: Never show fewer steps than what's currently displayed ────────────
      // Health Connect / HealthKit are batch APIs that can be behind the native
      // sensor. The native sensor drives the notification in real-time. When the
      // user opens the app, the displayed step count (from onStepUpdate events or
      // previous loadData) should never drop — even if HC/HK returns a lower value.
      // This is the same "never decrease" rule that onStepUpdate uses, but
      // applied to loadData's batch result.
      // Skip during midnight reset (steps legitimately go to 0).
      // NOTE: We read from lastLoadDataStepsRef which tracks the highest step count
      // ever set by either loadData or onStepUpdate. The Zustand store (MMKV) is
      // only updated by loadData and may be stale if onStepUpdate advanced the count.
      if (!midnightResetPendingRef.current) {
        const currentFloor = lastLoadDataStepsRef.current;
        if (currentFloor > result.steps) {
          result = { ...result, steps: currentFloor };
        }
      }

      setData(result);
      setLastUpdated(new Date());

      // ── Track HC floor for real-time native increments ──────────────────────
      // Store the step count from this loadData call. onStepUpdate will use this
      // as a floor: native sensor increments get applied ON TOP of this value.
      // This covers watch/external source steps that the phone sensor doesn't know.
      if (Platform.OS === 'android' && p !== 'native_sensor') {
        lastLoadDataStepsRef.current = result.steps;
      }

      // Persist to MMKV store for cache hydration on next launch
      useHealthDataStore.getState().setData(result);
      useHealthDataStore.getState().setLastFetchedAt(Date.now());
      lastFetchedAtRef.current = Date.now();

      // FIX: Removed forceRefreshSteps() call here. Previously this fed the
      // HC-read step count back into the native service's liveStepCount, creating
      // a circular inflation loop. The native StepCounterService updates the
      // notification and widget directly from the hardware sensor — no need to
      // push values from the JS layer.
      // The widget/notification will be slightly behind HC for a few seconds,
      // but that's far better than 3x step inflation.
      //
      // UPDATE: Re-enabled for widget/notification display sync ONLY.
      // pushStepUpdate no longer changes liveStepCount (inflation loop broken).
      // This ensures widget/notification show HC value after reboot when native
      // sensor has fewer steps than HC (reboot resets the hardware counter).
      //
      // CRITICAL: Only push if midnight reset gate is NOT pending. During midnight
      // reset, the native service has already set steps to 0. Pushing cached data
      // from JS would overwrite that 0 with yesterday's steps.
      // Also skip if steps are 0 (nothing to push) or result came from native sensor
      // (would create circular update loop).
      if (Platform.OS === 'android' && 
          result.steps > 0 && 
          p !== 'native_sensor' &&
          !midnightResetPendingRef.current) {
        import('../../../services/stepService').then(({ stepService }) => {
          stepService.forceRefreshSteps(result.steps).catch(() => { /* non-fatal */ });
        });
      }
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
        // ── Day-change guard: if a step event arrives after midnight but before
        // the reset timer fires, detect it here and force an immediate reset.
        // This prevents a queued sensor event with yesterday's count from
        // briefly inflating today's display.
        const today = getLocalToday();
        if (today !== currentDateRef.current) {
          currentDateRef.current = today;
          lastKnownDateRef.current = today;
          midnightResetAtRef.current = Date.now();
          midnightResetPendingRef.current = true; // Gate: block subsequent stale events
          const freshData = { ...defaultHealthData };
          setData(freshData);
          setLastUpdated(new Date());
          useHealthDataStore.getState().setData(freshData);
          useHealthDataStore.getState().setSyncedStepOffset(0, '');
          useHealthDataStore.getState().setSyncedServerBaseline(null, '');
          lastFetchedAtRef.current = 0;
          lastRawNativeRef.current = 0;
          lastLoadDataStepsRef.current = 0;
          // Don't apply this stale event — it's from yesterday.
          // The native service will emit 0 once its own reset fires.
          return;
        }

        // ── Post-midnight stale event guard ──────────────────────────────────
        // After midnight reset, ALL step updates are blocked until the native
        // sensor confirms it has properly reset (reports ≤ 50 steps).
        // Once confirmed, the gate opens and normal updates resume.
        if (midnightResetPendingRef.current) {
          if (newSteps <= 50) {
            // Native sensor has confirmed reset — open the gate
            midnightResetPendingRef.current = false;
            console.log(`[useHealth] Midnight reset confirmed: native sensor at ${newSteps} steps`);
          } else {
            // Still reporting yesterday's count — ignore
            console.log(`[useHealth] Blocking stale native event: ${newSteps} steps (waiting for reset confirmation)`);
            return;
          }
        }

        // Add synced offset from server (steps from previous device today)
        // Only for native_sensor mode — HC/HK handle their own step totals.
        let totalSteps = newSteps;
        if (platformRef.current === 'native_sensor') {
          const { syncedStepOffset, syncedStepOffsetDate, syncedServerBaseline, syncedServerBaselineDate } = useHealthDataStore.getState();
          const offset = syncedStepOffsetDate === today ? syncedStepOffset : 0;
          totalSteps = newSteps + offset;

          // Ensure steps never drop below the server baseline (reinstall continuity)
          if (syncedServerBaseline && syncedServerBaselineDate === today) {
            totalSteps = Math.max(totalSteps, syncedServerBaseline.steps);
          }
        } else {
          // HC/HK mode: When login was today and server baseline exists, compute
          // the real-time total using: serverBaseline + postLoginNativeSteps.
          // The native service now emits raw hardware dailySteps (not capped by
          // displayStepFloor). We compute the delta from nativeStepsAtLogin to get
          // only steps walked AFTER login, then add to the server baseline.
          const { syncedServerBaseline, syncedServerBaselineDate, nativeStepsAtLogin, loginTimestamp } = useHealthDataStore.getState();
          const isLoginToday = loginTimestamp ? (() => {
            const ld = new Date(loginTimestamp);
            const now = new Date();
            return ld.getFullYear() === now.getFullYear() &&
                   ld.getMonth() === now.getMonth() &&
                   ld.getDate() === now.getDate();
          })() : false;

          if (isLoginToday && syncedServerBaseline && syncedServerBaselineDate === today) {
            const { bonusSteps: storedBonus, bonusStepsDate } = useHealthDataStore.getState();
            const todayBonus = bonusStepsDate === today ? (storedBonus || 0) : 0;
            const serverDeviceSteps = Math.max(0, syncedServerBaseline.steps - todayBonus);
            // Post-login steps = current raw hardware steps - hardware steps at login time
            // nativeStepsAtLogin may be 0 if the service just started at login — that's valid.
            const postLoginSteps = Math.max(0, newSteps - nativeStepsAtLogin);
            totalSteps = serverDeviceSteps + postLoginSteps;
          }
          // If not login today or no baseline, use newSteps as-is (raw hardware count)
        }

        // Re-derive calories/distance/activeMinutes from updated step count so the
        // dashboard always shows all metrics live, not just steps. Without this,
        // onStepUpdate only patches data.steps and leaves calories/distance/activeTime
        // at their last loadData value (which can be 0 before the first batch read).
        const deriveMetrics = (steps: number) => {
          const { deriveFromSteps: derive } = getHealthConnectService();
          const d = derive(steps, weightKg, gender ?? undefined);
          return { calories: d.calories, distance: d.distanceKm, activeMinutes: d.activeMinutes };
        };

        setData(prev => {
          if (prev.steps === totalSteps) return prev;
          // In healthconnect/healthkit mode, the native sensor is a supplementary
          // source for real-time updates between loadData refreshes.
          // Rules:
          // 1. Never decrease: if native reports less than what's displayed (HC
          //    batch might have set a higher value), keep the displayed value.
          // 2. Always increase: if native exceeds what's displayed, show it
          //    immediately — the user is actively walking and should see live count.
          // 3. After loadData runs (every 90s), HC's batch value becomes the new
          //    floor via setData(result). Native can then only go UP from there.
          // 4. FIX: If HC reported higher steps (e.g., from a watch), and native
          //    is still lower but INCREASING, apply the native delta on top of
          //    the displayed (HC) value. This allows live counting to continue
          //    after HC sets a floor that native hasn't reached yet.
          if (platformRef.current !== 'native_sensor') {
            if (totalSteps >= prev.steps) {
              // Native computed value exceeds display — use it directly
              lastRawNativeRef.current = newSteps;
              if (totalSteps > lastLoadDataStepsRef.current) {
                lastLoadDataStepsRef.current = totalSteps;
              }
              return { ...prev, steps: totalSteps, ...deriveMetrics(totalSteps) };
            }
            // Native is below displayed value (HC/watch set a higher floor).
            // Check if native is INCREASING from its last known raw value.
            // If yes, apply that increment on top of what's currently displayed.
            const lastRaw = lastRawNativeRef.current;
            lastRawNativeRef.current = newSteps;
            if (lastRaw > 0 && newSteps > lastRaw) {
              const increment = newSteps - lastRaw;
              const newTotal = prev.steps + increment;
              if (newTotal > lastLoadDataStepsRef.current) {
                lastLoadDataStepsRef.current = newTotal;
              }
              // Push to notification/widget so they also show the increment
              // (native service only knows its own raw count, not HC+delta)
              if (Platform.OS === 'android') {
                import('../../../services/stepService').then(({ stepService }) => {
                  stepService.forceRefreshSteps(newTotal).catch(() => {});
                });
              }
              return { ...prev, steps: newTotal, ...deriveMetrics(newTotal) };
            }
            // Native not increasing or first event — keep displayed value
            return prev;
          }
          if (totalSteps > lastLoadDataStepsRef.current) {
            lastLoadDataStepsRef.current = totalSteps;
          }
          return { ...prev, steps: totalSteps, ...deriveMetrics(totalSteps) };
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
