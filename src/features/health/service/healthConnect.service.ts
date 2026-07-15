/**
 * healthConnect.service.ts
 *
 * Android 15+ — reads Steps directly from Health Connect (written by the
 * Android platform's built-in step sensor / Google Fit background service).
 * Derives calories, distance, and active minutes from the step count and
 * writes them back to Health Connect so every metric is visible in one place.
 *
 * NO external sensor libraries required — react-native-health-connect only.
 */

import {
  initialize,
  requestPermission,
  readRecords,
  aggregateRecord,
  insertRecords,
  deleteRecordsByTimeRange,
  getSdkStatus,
  getGrantedPermissions,
  SdkAvailabilityStatus,
  BackgroundAccessPermission,
  Permission,
} from 'react-native-health-connect';
import { HealthData, defaultHealthData } from '../types/healthTypes';

// ─── Derivation constants ─────────────────────────────────────────────────────
const DEFAULT_WEIGHT_KG = 70;
const STRIDE_MALE_M = 0.78;   // average male stride length in metres
const STRIDE_FEMALE_M = 0.70; // average female stride length in metres
const KCAL_PER_STEP = (kg: number) => (kg * 0.57) / 1000; // MET-based formula
const STEPS_PER_MINUTE = 100; // average walking cadence

export type GenderForStride = 'M' | 'F' | 'O' | null | undefined;

/** Returns stride length in metres based on gender. Defaults to male (0.78m). */
const getStrideM = (gender?: GenderForStride): number =>
  gender === 'F' ? STRIDE_FEMALE_M : STRIDE_MALE_M;

export const deriveFromSteps = (
  steps: number,
  weightKg = DEFAULT_WEIGHT_KG,
  gender?: GenderForStride,
) => ({
  calories: Math.round(steps * KCAL_PER_STEP(weightKg)),
  distanceKm: Math.round(steps * (getStrideM(gender) / 1000) * 100) / 100,
  activeMinutes: Math.round(steps / STEPS_PER_MINUTE),
});

// ─── Permissions ──────────────────────────────────────────────────────────────
//
// Only request what the app actually reads or writes.
// Derived metrics (calories, distance, exercise) are WRITTEN back to HC
// so they appear in the Health Connect UI — but we never READ them (we
// derive them from steps on every fetch instead).
// Height is never read or written by this app.
//
const PERMISSIONS: (Permission | BackgroundAccessPermission)[] = [
  // ── Activity ──────────────────────────────────────────────────────────────
  { accessType: 'read',  recordType: 'Steps' },
  { accessType: 'write', recordType: 'Steps' },
  // Write permission needed for native step counter on pre-Android 14 devices
  // to insert hardware sensor steps into Health Connect.

  // Derived metrics — write-only (we compute from steps, never read back)
  { accessType: 'write', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'write', recordType: 'Distance' },
  { accessType: 'write', recordType: 'ExerciseSession' },

  // ── Vitals ────────────────────────────────────────────────────────────────
  { accessType: 'read',  recordType: 'HeartRate' },
  { accessType: 'write', recordType: 'HeartRate' },

  { accessType: 'read',  recordType: 'BloodPressure' },
  { accessType: 'write', recordType: 'BloodPressure' },

  { accessType: 'read',  recordType: 'Weight' },
  { accessType: 'write', recordType: 'Weight' },

  // ── Hydration ─────────────────────────────────────────────────────────────
  { accessType: 'read',  recordType: 'Hydration' },
  { accessType: 'write', recordType: 'Hydration' },

  // ── Background ────────────────────────────────────────────────────────────
  { accessType: 'read',  recordType: 'BackgroundAccessPermission' },
];

// ─── Init ─────────────────────────────────────────────────────────────────────

export const isHealthConnectAvailable = async (): Promise<boolean> => {
  const status = await getSdkStatus();
  return status === SdkAvailabilityStatus.SDK_AVAILABLE;
};

/**
 * Check if Health Connect permissions are already granted (no UI prompt).
 * Returns true if at least 80% of required permissions are granted.
 */
export const hasHealthConnectPermissions = async (): Promise<boolean> => {
  try {
    const initialized = await initialize();
    if (!initialized) return false;
    const granted = await getGrantedPermissions();
    return granted.length >= PERMISSIONS.length * 0.8;
  } catch {
    return false;
  }
};

/** Small delay after initialize() to let the IPC binding fully settle.
 *  Without this, concurrent readRecords calls immediately after init
 *  cause RemoteException: Binding died / Null binding errors. */
const sleep = (ms: number) => new Promise((resolve: any) => setTimeout(resolve, ms));

export const initializeHealthConnect = async (): Promise<boolean> => {
  const initialized = await initialize();
  if (!initialized) return false;
  // Give the Health Connect service time to fully bind before any reads
  await sleep(300);
  const granted = await requestPermission(PERMISSIONS);
  // Accept if at least 80% of permissions were granted
  return granted.length >= PERMISSIONS.length * 0.8;
};

// ─── Retry helper ─────────────────────────────────────────────────────────────
//
// RemoteException (Binding died / Null binding / Binding to service failed)
// is a transient IPC error — the Health Connect service process restarted.
// Retrying after a short back-off resolves it in virtually all cases.
//
async function readWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 400,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      const isBindingError =
        typeof e?.message === 'string' &&
        (e.message.includes('Binding died') ||
          e.message.includes('Binding to service failed') ||
          e.message.includes('Null binding') ||
          e.message.includes('RemoteException'));
      if (!isBindingError || attempt === retries - 1) throw e;
      // Exponential back-off: 400ms, 800ms, 1600ms …
      await sleep(delayMs * Math.pow(2, attempt));
    }
  }
  throw lastError;
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

export const todayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return {
    operator: 'between' as const,
    startTime: start.toISOString(),
    endTime: new Date().toISOString(),
  };
};

/**
 * Get time range for today's step reading.
 *
 * Previously this filtered from loginTimestamp to prevent historical data
 * leaking into new accounts. However, this caused step count mismatches:
 * - After re-login on the same day, steps walked before login were invisible
 * - Notification/widget showed fewer steps than the phone's built-in pedometer
 * - Different surfaces showed different step counts
 *
 * FIX: Always read from startOfDay. The server already guards against
 * historical data injection via the accountCreatedDate check and anti-cheat
 * rate validation. Client-side filtering is no longer needed and was causing
 * more harm than good.
 *
 * @param _loginTimestamp — kept for API compat but no longer used for filtering
 */
export const sinceLoginRange = (_loginTimestamp: number | null) => {
  return todayRange();
};

export const lastNDays = (n: number) => ({
  operator: 'between' as const,
  startTime: new Date(Date.now() - n * 86400000).toISOString(),
  endTime: new Date().toISOString(),
});

// ─── Write derived metrics back to Health Connect ─────────────────────────────
//
//  Delete today's previously derived records first, then insert fresh ones.
//  This prevents values from multiplying on every refresh.
//
// FIX #3: Track last written step count to skip redundant delete+insert cycles.
let _lastDerivedWriteSteps: number = 0;

export const writeDerivedActivity = async (
  steps: number,
  weightKg = DEFAULT_WEIGHT_KG,
  gender?: GenderForStride,
): Promise<void> => {
  if (steps <= 0) return;

  // FIX #3: Skip if steps haven't changed since last write — avoids unnecessary
  // delete+insert of calories/distance/exercise records on every 90s poll.
  if (steps === _lastDerivedWriteSteps) return;
  _lastDerivedWriteSteps = steps;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const now = new Date();
  const todayFilter = {
    operator: 'between' as const,
    startTime: startOfDay.toISOString(),
    endTime: now.toISOString(),
  };

  const { calories, distanceKm, activeMinutes } = deriveFromSteps(
    steps,
    weightKg,
    gender,
  );

  const sessionEnd = new Date(
    Math.max(now.getTime(), startOfDay.getTime() + 60_000),
  );

  // Step 1 — delete today's existing derived records so we don't accumulate
  await Promise.all([
    deleteRecordsByTimeRange('ActiveCaloriesBurned', todayFilter).catch(
      () => {},
    ),
    deleteRecordsByTimeRange('Distance', todayFilter).catch(() => {}),
    deleteRecordsByTimeRange('ExerciseSession', todayFilter).catch(() => {}),
  ]);

  // Step 2 — insert fresh derived values
  await insertRecords([
    {
      recordType: 'ActiveCaloriesBurned',
      energy: { value: calories, unit: 'kilocalories' },
      startTime: startOfDay.toISOString(),
      endTime: now.toISOString(),
    },
  ]);

  await insertRecords([
    {
      recordType: 'Distance',
      distance: { value: distanceKm, unit: 'kilometers' },
      startTime: startOfDay.toISOString(),
      endTime: now.toISOString(),
    },
  ]);

  await insertRecords([
    {
      recordType: 'ExerciseSession',
      exerciseType: 56, // WALKING
      title: 'Daily Walking',
      startTime: startOfDay.toISOString(),
      endTime: sessionEnd.toISOString(),
    },
  ]);
};

// ─── Step deduplication ───────────────────────────────────────────────────────
//
// Health Connect can have steps from MULTIPLE data origins — Samsung Health,
// Google Fit, platform sensor, third-party apps like Sweatcoin, etc.
//
// aggregateRecord() sums all sources, which inflates the count on Samsung
// devices where Samsung Health and the platform sensor both write steps.
//
// Fix: read individual StepsRecord entries, group by dataOrigin, and keep only
// the single source with the highest step count. This mirrors what the native
// HealthSyncHelper.kt does and matches what Samsung Health shows.
//

// ─── FIX #5: Cache layer for readStepsDeduped ─────────────────────────────────
// Avoids redundant Health Connect reads when called multiple times within 30s.
// On devices with many health apps, each read can return dozens of records —
// caching prevents unnecessary IPC overhead on the Binder.
const STEP_CACHE_TTL_MS = 30_000; // 30 seconds
let _stepCacheValue: number = 0;
let _stepCacheTime: number = 0;
let _stepCacheKey: string = ''; // startTime+endTime fingerprint

export async function readStepsDeduped(
  startTime: string,
  endTime: string,
): Promise<number> {
  // FIX #5: Return cached value if within TTL and same time range
  const cacheKey = `${startTime}|${endTime}`;
  const now = Date.now();
  if (cacheKey === _stepCacheKey && now - _stepCacheTime < STEP_CACHE_TTL_MS) {
    return _stepCacheValue;
  }

  try {
    // Read individual records and pick the single highest-count source.
    // This prevents inflation from multiple apps (Samsung Health, Google Fit,
    // platform sensor) that all write StepsRecord to Health Connect.
    //
    // NOTE: We previously used aggregateRecord() on API 34+ assuming the
    // platform handles deduplication internally. However, Samsung devices
    // (OneUI) treat Samsung Health and the platform sensor as separate valid
    // sources and sum them, causing ~2x inflation. The readRecords + max-source
    // approach matches what the native HealthSyncHelper.kt does and produces
    // correct counts on all OEMs.
    const { records } = await readWithRetry(() =>
      readRecords('Steps', {
        timeRangeFilter: { operator: 'between' as const, startTime, endTime },
      }),
    );

    if (!records.length) return 0;

    // Group step totals by data origin (package name)
    const totals: Record<string, number> = {};
    for (const r of records) {
      const origin = (r as any).metadata?.dataOrigin ?? 'unknown';
      totals[origin] = (totals[origin] ?? 0) + ((r as any).count ?? 0);
    }

    console.log('[HealthConnect] Steps by origin:', totals);

    // Return the highest single-source total — this matches what Samsung Health
    // shows and what the native Kotlin worker reports.
    const result = Math.max(...Object.values(totals));

    // FIX #5: Store in cache
    _stepCacheValue = result;
    _stepCacheTime = Date.now();
    _stepCacheKey = cacheKey;

    return result;
  } catch (e) {
    console.warn('[HealthConnect] readStepsDeduped failed, falling back to aggregate:', e);
    // Fallback to aggregate if readRecords fails
    const aggResult = await aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: { operator: 'between' as const, startTime, endTime },
    }).catch(() => ({ COUNT_TOTAL: 0 }));
    const fallback = (aggResult as any).COUNT_TOTAL ?? 0;

    // FIX #5: Cache the fallback value too
    _stepCacheValue = fallback;
    _stepCacheTime = Date.now();
    _stepCacheKey = cacheKey;

    return fallback;
  }
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

export const fetchAllHealthConnectData = async (
  weightKg = DEFAULT_WEIGHT_KG,
  loginTimestamp: number | null = null,
  gender?: GenderForStride,
): Promise<HealthData> => {
  try {
    // Use sinceLoginRange for steps to prevent syncing historical data to new accounts
    const stepsTimeRange = sinceLoginRange(loginTimestamp);
    
    const [
      stepsResult,
      hrRecords,
      bpRecords,
      weightRecords,
      hydrationRecord,
    ] = await Promise.all([
      // Steps via readStepsDeduped() — reads individual records and picks the
      // single highest-count source. This prevents inflation from third-party
      // apps (Sweatcoin, Google Fit, Samsung Health) that also write Steps to
      // Health Connect. aggregate() sums all sources and over-counts.
      readStepsDeduped(stepsTimeRange.startTime, stepsTimeRange.endTime)
        .then(count => ({ COUNT_TOTAL: count }))
        .catch(e => {
          console.warn('Steps read failed:', e);
          return { COUNT_TOTAL: 0 };
        }),

      readWithRetry(() => readRecords('HeartRate', { timeRangeFilter: lastNDays(1) })).catch(e => {
        console.warn('HeartRate read failed:', e);
        return { records: [] };
      }),

      readWithRetry(() => readRecords('BloodPressure', { timeRangeFilter: lastNDays(7) })).catch(e => {
        console.warn('BloodPressure read failed:', e);
        return { records: [] };
      }),

      readWithRetry(() => readRecords('Weight', { timeRangeFilter: lastNDays(30) })).catch(e => {
        console.warn('Weight read failed:', e);
        return { records: [] };
      }),

      readWithRetry(() => readRecords('Hydration', { timeRangeFilter: todayRange() })).catch(e => {
        console.warn('Hydration read failed:', e);
        return { records: [] };
      }),
    ]);


  //    readRecords('Steps', {
  //   timeRangeFilter: {
  //     operator: 'between',
  //        startTime: stepsTimeRange.startTime,
  //         endTime:   stepsTimeRange.endTime,
  //   },
  // }).then(({ records }) => {
  //   console.log('Retrieved records: ', JSON.stringify({ records }, null, 2)); // Retrieved records:  {"records":[{"startTime":"2023-01-09T12:00:00.405Z","endTime":"2023-01-09T23:53:15.405Z","energy":{"inCalories":15000000,"inJoules":62760000.00989097,"inKilojoules":62760.00000989097,"inKilocalories":15000},"metadata":{"id":"239a8cfd-990d-42fc-bffc-c494b829e8e1","lastModifiedTime":"2023-01-17T21:06:23.335Z","clientRecordId":null,"dataOrigin":"com.healthconnectexample","clientRecordVersion":0,"device":0}}]}
  // });

  
    // ── Steps ─────────────────────────────────────────────────────────────
    const steps: number = (stepsResult as any).COUNT_TOTAL ?? 0;
    console.log(`[HealthConnect] Steps (aggregate): ${steps} since ${stepsTimeRange.startTime}`);

    // ── Always derive calories / distance / activeMinutes from steps ────────
    // This ensures values are always consistent with current step count,
    // never stale from a previous session's written records.
    const derived = deriveFromSteps(steps, weightKg, gender);
    const calories = derived.calories;
    const distance = derived.distanceKm;
    const activeMinutes = derived.activeMinutes;

    // ── Heart rate ─────────────────────────────────────────────────────────
    // Use last 24h of records to capture smartwatch data that spans midnight.
    // Prefer today's samples for the average, but show the most recent reading
    // if no data exists for today (common with smartwatches that sync periodically).
    const allSamples = hrRecords.records.flatMap(r => r.samples ?? []);
    const bpms = allSamples.map(s => s.beatsPerMinute);

    // Filter to only today's samples for the average display
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todaySamples = allSamples.filter(s => {
      const sampleTime = new Date(s.time).getTime();
      return sampleTime >= startOfToday.getTime();
    });
    const todayBpms = todaySamples.map(s => s.beatsPerMinute);

    // Use today's readings if available, otherwise fall back to all 24h readings
    const effectiveBpms = todayBpms.length > 0 ? todayBpms : bpms;
    const hrAvg = effectiveBpms.length
      ? Math.round(effectiveBpms.reduce((a, b) => a + b, 0) / effectiveBpms.length)
      : 0;

    console.log(`[HealthConnect] HR: ${hrRecords.records.length} records, ${allSamples.length} total samples, ${todaySamples.length} today samples, avg=${hrAvg}`);
    if (hrRecords.records.length > 0 && allSamples.length === 0) {
      console.warn('[HealthConnect] HR records exist but have no samples — smartwatch may use a different record format');
    }
    if (hrRecords.records.length === 0) {
      console.log('[HealthConnect] No HR records found in last 24h. Ensure smartwatch companion app syncs to Health Connect.');
    }

    // ── Blood pressure ─────────────────────────────────────────────────────
    const latestBP = bpRecords.records.at(-1);
    console.log(`[HealthConnect] BP: ${bpRecords.records.length} records in last 7 days, latest=${latestBP ? `${Math.round(latestBP.systolic.inMillimetersOfMercury)}/${Math.round(latestBP.diastolic.inMillimetersOfMercury)}` : 'none'}`);
    if (bpRecords.records.length === 0) {
      console.log('[HealthConnect] No BP records found in last 7 days. Ensure smartwatch companion app syncs BP to Health Connect.');
    }

    // ── Weight ─────────────────────────────────────────────────────────────
    const latestWeight = weightRecords.records.at(-1);

    // ── Hydration ───────────────────────────────────────────────────
    const hydrationMl = hydrationRecord.records.reduce((sum, r) => {
      const liters = r.volume?.inLiters ?? 0;
      return sum + liters * 1000; // convert → ml
    }, 0);

    const result: HealthData = {
      steps,
      calories,
      distance,
      activeMinutes,
      heartRate: hrAvg,
      hydration: Math.round(hydrationMl),
      heartRateMin: effectiveBpms.length ? Math.min(...effectiveBpms) : 0,
      heartRateMax: effectiveBpms.length ? Math.max(...effectiveBpms) : 0,
      bloodPressureSystolic: latestBP
        ? Math.round(latestBP.systolic.inMillimetersOfMercury)
        : 0,
      bloodPressureDiastolic: latestBP
        ? Math.round(latestBP.diastolic.inMillimetersOfMercury)
        : 0,
      sleepHours: 0,
      weight: latestWeight
        ? Math.round(latestWeight.weight.inKilograms * 10) / 10
        : 0,
      bloodGlucose: 0,
    };

    console.log('Health data fetched:', result);

    // Write derived records back so they persist in Health Connect
    // (fire-and-forget — don't await so it doesn't block the UI)
    writeDerivedActivity(steps, weightKg, gender).catch(e =>
      console.warn('writeDerivedActivity failed:', e),
    );

    return result;
  } catch (e) {
    console.error('fetchAllHealthConnectData failed:', e);
    return defaultHealthData;
  }
};

// ─── Manual write helpers ─────────────────────────────────────────────────────

export const writeWeightHC = async (kg: number, time: Date): Promise<void> => {
  await insertRecords([
    {
      recordType: 'Weight',
      weight: { value: kg, unit: 'kilograms' },
      time: time.toISOString(),
    },
  ]);
};

export const writeHeartRateHC = async (bpm: number): Promise<void> => {
  const now = new Date();
  const start = new Date(now.getTime() - 60_000);
  await insertRecords([
    {
      recordType: 'HeartRate',
      startTime: start.toISOString(),
      endTime: now.toISOString(),
      samples: [{ time: now.toISOString(), beatsPerMinute: bpm }],
    },
  ]);
};

// ─── BloodPressure enum values ────────────────────────────────────────────────
// bodyPosition:        0=UNKNOWN 1=STANDING_UP 2=SITTING_DOWN 3=LYING_DOWN 4=RECLINING
// measurementLocation: 0=UNKNOWN 1=LEFT_WRIST  2=RIGHT_WRIST  3=LEFT_UPPER_ARM 4=RIGHT_UPPER_ARM
export const writeBloodPressureHC = async (
  systolic: number,
  diastolic: number,
): Promise<void> => {
  await insertRecords([
    {
      recordType: 'BloodPressure',
      systolic: { value: systolic, unit: 'millimetersOfMercury' },
      diastolic: { value: diastolic, unit: 'millimetersOfMercury' },
      time: new Date().toISOString(),
      bodyPosition: 0, // UNKNOWN
      measurementLocation: 0, // UNKNOWN
    },
  ]);
};

/** @deprecated Do not write Steps — it creates a second source that inflates aggregate() counts. */
export const writeStepsHC = async (
  count: number,
  start: Date,
  end: Date,
): Promise<void> => {
  // No-op: writing Steps from the app causes double-counting in aggregate().
  // The platform step counter (com.google.android.gms etc.) is the only
  // authoritative source and writes steps automatically.
  console.warn('[writeStepsHC] Skipped — app must not write Steps to Health Connect');
};

export const writeHydrationHC = async (
  ml: number,
  start: Date,
  end: Date,
): Promise<void> => {
  await insertRecords([
    {
      recordType: 'Hydration',
      volume: {
        unit: 'liters',
        value: ml / 1000, // ✅ convert ml → liters
      },
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    },
  ]);
};
