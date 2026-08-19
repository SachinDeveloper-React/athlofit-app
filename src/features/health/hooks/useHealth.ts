import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { HealthData, defaultHealthData } from '../types/healthTypes';
import { useHealthDataStore } from '../store/healthDataStore';
import { useHealthInitStore } from '../store/healthInitStore';
import { useStepDebugStore } from '../store/stepDebugStore';
import { getLocalToday } from '../../../utils/date';
import {
  resolveSteps,
  detectServerEcho,
  minutesSinceLocalMidnight,
  MAX_STEPS_PER_MINUTE,
  type StepSourceInput,
  type ServerSourceInput,
  type StepResolution,
} from '../service/stepEngine';
import type { StepOriginTotal } from '../service/healthConnect.service';

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

/**
 * How long a source's last reading stands in for the source when its next read
 * fails. Long enough to ride out a Binder hiccup or a Health Connect provider
 * restart, short enough that a genuinely dead source stops influencing the total.
 */
const SOURCE_MEMORY_TTL_MS = 15 * 60_000;

interface RememberedSource {
  steps: number;
  at: number;
  date: string;
}

/**
 * Returns a source's remembered reading if it is still usable, otherwise null.
 *
 * Scoped to one source and one day, and always replaced by the next real reading
 * in either direction — this is a stand-in for a failed read, not a floor under
 * the final total.
 */
function recallSource(memory: RememberedSource | null, today: string): number | null {
  if (!memory) return null;
  if (memory.date !== today) return null;
  if (Date.now() - memory.at > SOURCE_MEMORY_TTL_MS) return null;
  if (memory.steps <= 0) return null;
  return memory.steps;
}

/**
 * Step-derived metrics. Kept here so the native-sensor path and the Health
 * Connect path cannot drift apart on the constants they use.
 */
function deriveStepMetrics(
  steps: number,
  weightKg: number,
  gender?: 'M' | 'F' | 'O' | null,
) {
  const STEPS_PER_MINUTE = 100;
  const strideM = gender === 'F' ? 0.70 : 0.78;
  return {
    calories: Math.round(steps * ((weightKg * 0.57) / 1000)),
    distanceKm: Math.round(steps * (strideM / 1000) * 100) / 100,
    activeMinutes: Math.round(steps / STEPS_PER_MINUTE),
  };
}

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

  // ── Per-source read memory ────────────────────────────────────────────────
  // Covers a source whose read just failed, so a transient Health Connect error
  // does not make the count jump around. See recallSource above.
  //
  // This replaces the old `lastLoadDataStepsRef` monotonic floor, which was the
  // main reason a wrong number could never be corrected. That ref was seeded from
  // the persisted total, forced into every subsequent result, and written back to
  // storage — a closed loop in which one bad reading became the permanent minimum
  // for the rest of the day and survived app restarts. Since the total is now
  // recomputed from the sources on every cycle, a bad reading lasts exactly as long
  // as the source that produced it.
  const sourceMemoryRef = useRef<{ primary: RememberedSource | null }>({ primary: null });

  /**
   * Last resolution, so live sensor events can re-resolve against the same
   * Health Connect and server readings without re-reading them, and so the debug
   * screen shows the decision the pipeline actually made.
   */
  const stepResolutionRef = useRef<{
    resolution: StepResolution;
    hcOrigins: StepOriginTotal[];
    hcMethod: string;
    at: number;
  } | null>(null);

  /** Inputs of the last resolve, reused by the live native sensor subscription. */
  const lastResolveInputRef = useRef<{
    primary: StepSourceInput;
    server: ServerSourceInput;
    bonusSteps: number;
    date: string;
    /**
     * The hardware sensor's value at the moment `primary` was read. Live events
     * measure their increment against this anchor, so the increment always covers
     * exactly the time the batch source has not caught up with yet.
     */
    nativeAtResolve: number;
    /**
     * When this resolve happened. Bounds the live projection by the steps that
     * could physically have been walked since — see the live handler.
     */
    at: number;
  } | null>(null);

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
          sourceMemoryRef.current.primary = null;
          lastResolveInputRef.current = null;

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
      sourceMemoryRef.current.primary = null;
      lastResolveInputRef.current = null;

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
      // The flag is checked against today's date, not just its boolean value: it
      // is persisted, so once set it used to read true forever and every day
      // after the first skipped this wait entirely — resolving the step count
      // before today's server baseline had arrived.
      if (!useHealthDataStore.getState().isStepOffsetFetchedToday()) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 3000); // Don't block more than 3s
          const unsubscribe = useHealthDataStore.subscribe((state) => {
            if (state.stepOffsetFetched && state.stepOffsetFetchedDate === getLocalToday()) {
              clearTimeout(timeout);
              unsubscribe();
              resolve();
            }
          });
          // Re-check in case it was set between the if-check and subscribe
          if (useHealthDataStore.getState().isStepOffsetFetchedToday()) {
            clearTimeout(timeout);
            unsubscribe();
            resolve();
          }
        });
      }

      // ── 1. Read the primary platform source ─────────────────────────────────
      // HealthKit on iOS, Health Connect on Android, or nothing in native-sensor
      // mode. Steps always cover the full local day (see the note on todayRange in
      // healthConnect.service.ts), so there is never a pre-login gap to patch up.
      let result: HealthData = { ...defaultHealthData };
      let primaryRead: StepSourceInput = { steps: 0, available: false };
      let hcOrigins: StepOriginTotal[] = [];
      let hcMethod = 'not-used';

      if (p === 'healthkit') {
        const hk = await fetchAllHealthKitData();
        result = hk;
        // HealthKit has no per-origin breakdown and no explicit failure signal;
        // a positive reading is the only evidence the read worked.
        primaryRead = { steps: hk.steps, available: hk.steps > 0 };
      } else if (p === 'healthconnect') {
        const { fetchAllHealthConnectData } = getHealthConnectService();
        const hc = await fetchAllHealthConnectData(weightKg, null, gender, null);
        result = hc;
        // stepRead is optional-chained because the service is reached through a
        // runtime require (Health Connect is Android-only), so its shape is not
        // checked at compile time.
        primaryRead = hc.stepRead
          ? { steps: hc.stepRead.steps, available: hc.stepRead.available }
          : { steps: hc.steps ?? 0, available: (hc.steps ?? 0) > 0 };
        hcOrigins = hc.stepRead?.origins ?? [];
        hcMethod = hc.stepRead?.method ?? 'unknown';
      } else if (p === 'native_sensor' && Platform.OS === 'android') {
        // Native-sensor mode still tries Health Connect, because on devices where
        // the OEM kills our foreground service the platform keeps writing steps
        // there and it becomes the only source that is still counting. The read is
        // expected to fail when the permission was never granted, which the engine
        // handles as "unavailable" rather than as zero.
        try {
          const { readTodayStepsDetailed, todayRange: range } = getHealthConnectService();
          const r = range();
          const read = await readTodayStepsDetailed(r.startTime, r.endTime);
          primaryRead = { steps: read.steps, available: read.available };
          hcOrigins = read.origins;
          hcMethod = read.method;
        } catch {
          primaryRead = { steps: 0, available: false };
        }
      }

      // ── 2. Read the native hardware sensor ──────────────────────────────────
      let nativeRead: StepSourceInput = { steps: 0, available: false };
      if (Platform.OS === 'android') {
        try {
          const { stepService } = await import('../../../services/stepService');
          const nativeSteps = await stepService.getCurrentSteps();
          // getCurrentSteps returns 0 both for "no steps yet" and "service not
          // running". Either way it is a genuine reading of the sensor's state.
          nativeRead = { steps: nativeSteps, available: true };

          // The native sensor confirms the midnight reset landed by reporting a
          // near-zero count. Until then it may still be holding yesterday's total.
          if (midnightResetPendingRef.current && nativeSteps <= 50) {
            midnightResetPendingRef.current = false;
            console.log(`[useHealth] Midnight reset confirmed by sensor at ${nativeSteps}`);
          }
        } catch {
          nativeRead = { steps: 0, available: false };
        }
      }

      // ── 3. Read the server value for today ──────────────────────────────────
      // Stored at login by stepOffset.service. Its `steps` field is device + bonus,
      // so bonus is removed here: the engine works in device steps throughout and
      // bonus is re-added only for display. Adding it in both places is what used
      // to double count admin-credited steps.
      const today = getLocalToday();
      const {
        syncedServerBaseline,
        syncedServerBaselineDate,
        bonusSteps: storedBonus,
        bonusStepsDate,
        lastPushedSteps,
        lastPushedStepsDate,
      } = useHealthDataStore.getState();

      const todayBonus = bonusStepsDate === today ? Math.max(0, storedBonus || 0) : 0;
      const hasServerToday = !!syncedServerBaseline && syncedServerBaselineDate === today;
      const serverDeviceSteps = hasServerToday
        ? Math.max(0, (syncedServerBaseline!.steps || 0) - todayBonus)
        : 0;
      const serverRead: ServerSourceInput = {
        steps: serverDeviceSteps,
        available: hasServerToday,
        isEcho: hasServerToday
          ? detectServerEcho(serverDeviceSteps, lastPushedSteps, lastPushedStepsDate)
          : null,
      };

      // ── 4. Cover a momentarily unavailable source ───────────────────────────
      // Health Connect reads can fail transiently (Binder timeout, provider
      // restart). Substituting that source's OWN last reading keeps the display
      // steady instead of collapsing to whatever the other sources say.
      //
      // This is deliberately not the old "never decrease" floor. It is scoped to a
      // single source, expires after SOURCE_MEMORY_TTL_MS, and is overwritten by
      // the next real reading whether that reading is higher or lower — so it can
      // remember that Health Connect said 5,000, but it can never make the final
      // total stick at a value no source ever reported.
      const rememberedPrimary = recallSource(sourceMemoryRef.current.primary, today);
      if (!primaryRead.available && rememberedPrimary !== null) {
        primaryRead = { steps: rememberedPrimary, available: true };
        console.log(`[useHealth] Primary source unavailable — using its last reading (${rememberedPrimary})`);
      }
      if (primaryRead.available) {
        sourceMemoryRef.current.primary = { steps: primaryRead.steps, at: Date.now(), date: today };
      }

      // ── 5. Resolve ──────────────────────────────────────────────────────────
      const resolution = resolveSteps({
        healthConnect: primaryRead,
        nativeSensor: nativeRead,
        server: serverRead,
        bonusSteps: todayBonus,
        minutesElapsedToday: minutesSinceLocalMidnight(),
      });

      stepResolutionRef.current = { resolution, hcOrigins, hcMethod, at: Date.now() };
      // Cached for the live sensor subscription, which re-resolves every few
      // seconds and must not re-read Health Connect at that rate.
      lastResolveInputRef.current = {
        primary: primaryRead,
        server: serverRead,
        bonusSteps: todayBonus,
        date: today,
        nativeAtResolve: nativeRead.available ? nativeRead.steps : 0,
        at: Date.now(),
      };
      useStepDebugStore.getState().setSnapshot({
        resolution,
        hcOrigins,
        hcMethod,
        platform: p,
        serverBaselineDate: syncedServerBaselineDate,
        bonusStepsDate,
        lastPushedSteps,
        lastPushedStepsDate,
        at: Date.now(),
      });

      if (resolution.rejected.length > 0) {
        console.log(
          `[useHealth] Steps → ${resolution.deviceSteps} (${resolution.explanation}). ` +
          `Rejected: ${resolution.rejected.map(r => `${r.id}=${r.steps} (${r.reason})`).join('; ')}`,
        );
      }

      // ── 6. Repair a drifted hardware counter ────────────────────────────────
      // The engine rejects the native sensor only when it exceeds a full-day Health
      // Connect reading by more than 2x, which means its rebootOffset has drifted.
      // That is a precise signal now that both sources cover the same window; the
      // old check compared an all-day sensor value against a post-login-only Health
      // Connect value, so it fired during normal use and reset a perfectly good
      // counter (leaving the sensor reporting a few hundred steps for the day).
      const nativeRejected = resolution.rejected.find(r => r.id === 'native_sensor');
      if (
        Platform.OS === 'android' &&
        nativeRejected &&
        primaryRead.available &&
        primaryRead.steps > 0
      ) {
        const { stepService } = await import('../../../services/stepService');
        stepService.correctInflatedSteps(primaryRead.steps).catch(() => { /* non-fatal */ });
      }

      // ── 7. Build the health snapshot ────────────────────────────────────────
      // `steps` here is DEVICE steps — bonus is excluded. Consumers add bonus for
      // display and sync this value as-is. Keeping one meaning for the field
      // removes the add-here-subtract-there dance that used to surround it.
      const derived = deriveStepMetrics(resolution.deviceSteps, weightKg, gender);
      result = {
        ...result,
        steps: resolution.deviceSteps,
        // Calories, distance and active minutes are pure functions of the step
        // count, so they are derived from the resolved value rather than carried
        // over from a source or floored against the server. If they were floored
        // independently they could disagree with the steps shown next to them.
        calories: derived.calories,
        distance: derived.distanceKm,
        activeMinutes: derived.activeMinutes,
      };

      // Vitals are not step-derived, so a server value is still the best available
      // fallback when the device has no reading this cycle.
      if (hasServerToday) {
        const b = syncedServerBaseline!;
        result = {
          ...result,
          heartRate: result.heartRate || b.heartRate,
          heartRateMin: result.heartRateMin || b.heartRateMin,
          heartRateMax: result.heartRateMax || b.heartRateMax,
          bloodPressureSystolic: result.bloodPressureSystolic || b.bloodPressureSystolic,
          bloodPressureDiastolic: result.bloodPressureDiastolic || b.bloodPressureDiastolic,
          sleepHours: Math.max(result.sleepHours, b.sleepHours),
          weight: result.weight || b.weight,
          bloodGlucose: result.bloodGlucose || b.bloodGlucose,
          hydration: Math.max(result.hydration, b.hydration),
        };
      }

      // ── 8. Midnight gate ────────────────────────────────────────────────────
      // Belt and braces alongside the engine's elapsed-time bound: until the native
      // sensor confirms it reset, show 0 rather than risk surfacing yesterday.
      if (midnightResetPendingRef.current && result.steps > 50) {
        console.log(`[useHealth] Midnight gate pending — holding steps at 0 (was ${result.steps})`);
        result = { ...result, steps: 0, calories: 0, distance: 0, activeMinutes: 0 };
      }

      setData(result);
      setLastUpdated(new Date());

      // Persist for cache hydration on next launch.
      useHealthDataStore.getState().setData(result);
      useHealthDataStore.getState().setLastFetchedAt(Date.now());
      lastFetchedAtRef.current = Date.now();

      // Keep the notification and widget on the same number as the app. The floor
      // is set (not ratcheted) on the native side, so when the app corrects itself
      // downward those surfaces follow instead of staying stuck high.
      if (Platform.OS === 'android' && !midnightResetPendingRef.current) {
        const displayTotal = result.steps + todayBonus;
        import('../../../services/stepService').then(({ stepService }) => {
          stepService.forceRefreshSteps(displayTotal).catch(() => { /* non-fatal */ });
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
          sourceMemoryRef.current.primary = null;
          lastResolveInputRef.current = null;
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

        // ── Re-resolve with the fresh sensor reading ─────────────────────────
        // The sensor is one input to the same decision loadData makes, so the
        // total is recomputed from all sources rather than patched.
        //
        // What this replaces: the old handler took the difference between this
        // event and the previous one and ADDED it to whatever was on screen. But
        // what was on screen was usually the Health Connect total, and Health
        // Connect already contains the platform pedometer's records — the very
        // same hardware this event comes from. So every step the user took was
        // counted once by Health Connect and again as a delta, and because a
        // separate floor kept the result from ever going back down, the error
        // compounded for as long as the app stayed open. It also fired
        // `serverBaseline + postLoginSteps` on a second path, adding a third
        // count of the same walk.
        //
        // The other inputs (Health Connect, server) are reused from the last
        // loadData rather than re-read: this runs every 5 seconds and a Health
        // Connect read is far too expensive for that cadence.
        const cached = lastResolveInputRef.current?.date === today
          ? lastResolveInputRef.current
          : null;

        // ── Projecting Health Connect forward ────────────────────────────────
        // Health Connect is a batch source and its value is up to 90 seconds old,
        // so on its own it would leave the count frozen while the user is actually
        // walking. The steps taken since that read are exactly the sensor's
        // increment over its value at the time of the read, so adding that
        // increment brings the batch figure up to date.
        //
        // This addition is bounded and non-cumulative, which is what separates it
        // from the bug above. Both the anchor (`nativeAtResolve`) and the base
        // (`cached.primary`) are fixed until the next loadData, so the projection is
        // a pure function of the current sensor value — walk 100 steps and it reads
        // +100, not +100 on top of the last +100. Every loadData discards it and
        // starts again from a real Health Connect read.
        // The increment is additionally bounded by what could physically have been
        // walked since the resolve, which closes the one hole in the reasoning
        // above: the anchor is only a valid anchor if it was a real reading.
        //
        // getCurrentSteps() returns 0 both for "no steps yet" and for "the service
        // is not running", and loadData records the reading as available either way.
        // So a cycle that ran while the foreground service was dead anchors at 0,
        // and when the service comes back reporting 7,000 the "increment" is the
        // whole day — projecting Health Connect to roughly double. The elapsed-time
        // bound turns that into at most a few hundred steps, and the next loadData
        // re-anchors from a real reading.
        const elapsedMinSinceResolve = cached
          ? Math.max(1, (Date.now() - cached.at) / 60_000)
          : 0;
        const maxIncrement = Math.ceil(elapsedMinSinceResolve * MAX_STEPS_PER_MINUTE);
        const rawIncrement = cached
          ? Math.max(0, newSteps - cached.nativeAtResolve)
          : 0;
        const liveIncrement = Math.min(rawIncrement, maxIncrement);
        if (rawIncrement > maxIncrement) {
          console.warn(
            `[useHealth] Live increment ${rawIncrement} exceeds the ` +
            `${Math.round(elapsedMinSinceResolve)}min bound (${maxIncrement}) — ` +
            `sensor anchor was ${cached?.nativeAtResolve}, clamping`,
          );
        }
        const projectedPrimary: StepSourceInput = cached?.primary.available
          ? { steps: cached.primary.steps + liveIncrement, available: true }
          : { steps: 0, available: false };

        const liveResolution = resolveSteps({
          healthConnect: projectedPrimary,
          nativeSensor: { steps: newSteps, available: true },
          server: cached ? cached.server : { steps: 0, available: false, isEcho: null },
          bonusSteps: 0, // bonus is added by the display layer, not here
          minutesElapsedToday: minutesSinceLocalMidnight(),
        });

        const nextSteps = liveResolution.deviceSteps;

        setData(prev => {
          if (prev.steps === nextSteps) return prev;
          const derived = deriveStepMetrics(nextSteps, weightKg, gender);
          return {
            ...prev,
            steps: nextSteps,
            calories: derived.calories,
            distance: derived.distanceKm,
            activeMinutes: derived.activeMinutes,
          };
        });
        setLastUpdated(new Date());

        // Keep the persisted snapshot in step with what is on screen, so a
        // relaunch hydrates from the same value the user last saw.
        const store = useHealthDataStore.getState();
        if (store.data.steps !== nextSteps) {
          store.setData({
            ...store.data,
            steps: nextSteps,
            ...(() => {
              const d = deriveStepMetrics(nextSteps, weightKg, gender);
              return { calories: d.calories, distance: d.distanceKm, activeMinutes: d.activeMinutes };
            })(),
          });
        }
      });
    })();

    return () => { unsubscribe?.(); };
  }, [weightKg, gender]);

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
