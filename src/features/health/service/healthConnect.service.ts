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
  SdkAvailabilityStatus,
  BackgroundAccessPermission,
  Permission,
} from 'react-native-health-connect';
import { HealthData, defaultHealthData } from '../types/healthTypes';

// ─── Derivation constants (70 kg, 76 cm stride adult baseline) ────────────────
const DEFAULT_WEIGHT_KG = 70;
const STRIDE_M = 0.76; // metres per step
const KCAL_PER_STEP = (kg: number) => (kg * 0.57) / 1000; // MET-based formula
const STEPS_PER_MINUTE = 100; // average walking cadence

export const deriveFromSteps = (
  steps: number,
  weightKg = DEFAULT_WEIGHT_KG,
) => ({
  calories: Math.round(steps * KCAL_PER_STEP(weightKg)),
  distanceKm: Math.round(steps * (STRIDE_M / 1000) * 100) / 100,
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
  // NOTE: We do NOT write Steps — writing our own step records would cause
  // them to appear as a second source in aggregate(), inflating the count.

  // Derived metrics — write-only (we compute from steps, never read back)
  { accessType: 'write', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'write', recordType: 'Distance' },
  { accessType: 'write', recordType: 'ExerciseSession' },

  // ── Vitals ────────────────────────────────────────────────────────────────
  { accessType: 'read',  recordType: 'HeartRate' },
  { accessType: 'write', recordType: 'HeartRate' },

  { accessType: 'read',  recordType: 'BloodPressure' },
  { accessType: 'write', recordType: 'BloodPressure' },

  { accessType: 'read',  recordType: 'BloodGlucose' },
  { accessType: 'write', recordType: 'BloodGlucose' },

  { accessType: 'read',  recordType: 'Weight' },
  { accessType: 'write', recordType: 'Weight' },

  // ── Sleep ─────────────────────────────────────────────────────────────────
  { accessType: 'read',  recordType: 'SleepSession' },
  { accessType: 'write', recordType: 'SleepSession' },

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
 * Get time range from login timestamp to now (for filtering historical data)
 * If no login timestamp, falls back to today's range
 */
export const sinceLoginRange = (loginTimestamp: number | null) => {
  if (!loginTimestamp) {
    return todayRange();
  }
  
  // Use the later of: login timestamp OR start of today
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const effectiveStart = Math.max(loginTimestamp, startOfDay.getTime());
  
  return {
    operator: 'between' as const,
    startTime: new Date(effectiveStart).toISOString(),
    endTime: new Date().toISOString(),
  };
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
export const writeDerivedActivity = async (
  steps: number,
  weightKg = DEFAULT_WEIGHT_KG,
): Promise<void> => {
  if (steps <= 0) return;

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

// ─── Main fetch ───────────────────────────────────────────────────────────────

export const fetchAllHealthConnectData = async (
  weightKg = DEFAULT_WEIGHT_KG,
  loginTimestamp: number | null = null,
): Promise<HealthData> => {
  try {
    // Use sinceLoginRange for steps to prevent syncing historical data to new accounts
    const stepsTimeRange = sinceLoginRange(loginTimestamp);
    
    const [
      stepsResult,
      hrRecords,
      bpRecords,
      sleepRecords,
      weightRecords,
      glucoseRecords,
      hydrationRecord,
    ] = await Promise.all([
      // Steps via aggregateRecord() — the correct API for cumulative data.
      // Automatically deduplicates overlapping records from multiple apps
      // (Sweatcoin, Strava, etc.) and uses the most authoritative source
      // (the device's native step counter). Works on every Android OEM.
      readWithRetry(() => aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: {
          operator: 'between' as const,
          startTime: stepsTimeRange.startTime,
          endTime:   stepsTimeRange.endTime,
        },
      })).catch(e => {
        console.warn('Steps aggregate failed:', e);
        return { COUNT_TOTAL: 0 };
      }),

      readWithRetry(() => readRecords('HeartRate', { timeRangeFilter: todayRange() })).catch(e => {
        console.warn('HeartRate read failed:', e);
        return { records: [] };
      }),

      readWithRetry(() => readRecords('BloodPressure', { timeRangeFilter: lastNDays(7) })).catch(e => {
        console.warn('BloodPressure read failed:', e);
        return { records: [] };
      }),

      readWithRetry(() => readRecords('SleepSession', { timeRangeFilter: lastNDays(1) })).catch(e => {
        console.warn('Sleep read failed:', e);
        return { records: [] };
      }),

      readWithRetry(() => readRecords('Weight', { timeRangeFilter: lastNDays(30) })).catch(e => {
        console.warn('Weight read failed:', e);
        return { records: [] };
      }),

      readWithRetry(() => readRecords('BloodGlucose', { timeRangeFilter: lastNDays(1) })).catch(e => {
        console.warn('BloodGlucose read failed:', e);
        return { records: [] };
      }),

      readWithRetry(() => readRecords('Hydration', { timeRangeFilter: todayRange() })).catch(e => {
        console.warn('Hydration read failed:', e);
        return { records: [] };
      }),
    ]);

    // ── Steps ─────────────────────────────────────────────────────────────
    const steps: number = (stepsResult as any).COUNT_TOTAL ?? 0;
    console.log(`[HealthConnect] Steps (aggregate): ${steps} since ${stepsTimeRange.startTime}`);

    // ── Always derive calories / distance / activeMinutes from steps ────────
    // This ensures values are always consistent with current step count,
    // never stale from a previous session's written records.
    const derived = deriveFromSteps(steps, weightKg);
    const calories = derived.calories;
    const distance = derived.distanceKm;
    const activeMinutes = derived.activeMinutes;

    // ── Heart rate ─────────────────────────────────────────────────────────
    const allSamples = hrRecords.records.flatMap(r => r.samples ?? []);
    const bpms = allSamples.map(s => s.beatsPerMinute);
    const hrAvg = bpms.length
      ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length)
      : 0;

    // ── Blood pressure ─────────────────────────────────────────────────────
    const latestBP = bpRecords.records.at(-1);

    // ── Sleep ──────────────────────────────────────────────────────────────
    const sleepMs = sleepRecords.records.reduce(
      (sum, r) =>
        sum + (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()),
      0,
    );

    // ── Weight & glucose ───────────────────────────────────────────────────
    const latestWeight = weightRecords.records.at(-1);
    const latestGlucose = glucoseRecords.records.at(-1);

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
      heartRateMin: bpms.length ? Math.min(...bpms) : 0,
      heartRateMax: bpms.length ? Math.max(...bpms) : 0,
      bloodPressureSystolic: latestBP
        ? Math.round(latestBP.systolic.inMillimetersOfMercury)
        : 0,
      bloodPressureDiastolic: latestBP
        ? Math.round(latestBP.diastolic.inMillimetersOfMercury)
        : 0,
      sleepHours: Math.round((sleepMs / 3_600_000) * 10) / 10,
      weight: latestWeight
        ? Math.round(latestWeight.weight.inKilograms * 10) / 10
        : 0,
      bloodGlucose: latestGlucose
        ? Math.round(latestGlucose.level.inMillimolesPerLiter * 10) / 10
        : 0,
    };

    console.log('Health data fetched:', result);

    // Write derived records back so they persist in Health Connect
    // (fire-and-forget — don't await so it doesn't block the UI)
    writeDerivedActivity(steps, weightKg).catch(e =>
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

// ─── BloodGlucose enum values ─────────────────────────────────────────────────
// specimenSource:  0=UNKNOWN 1=INTERSTITIAL_FLUID 2=CAPILLARY_BLOOD 3=PLASMA 4=SERUM 5=TEARS 6=WHOLE_BLOOD
// mealType:        0=UNKNOWN 1=BREAKFAST 2=LUNCH 3=DINNER 4=SNACK
// relationToMeal:  0=UNKNOWN 1=GENERAL   2=FASTING 3=BEFORE_MEAL 4=AFTER_MEAL
export const writeBloodGlucoseHC = async (mmol: number): Promise<void> => {
  await insertRecords([
    {
      recordType: 'BloodGlucose',
      level: { value: mmol, unit: 'millimolesPerLiter' },
      time: new Date().toISOString(),
      specimenSource: 2, // CAPILLARY_BLOOD
      mealType: 0, // UNKNOWN
      relationToMeal: 0, // UNKNOWN
    },
  ]);
};

export const writeSleepHC = async (
  bedtime: Date,
  wakeTime: Date,
): Promise<void> => {
  await insertRecords([
    {
      recordType: 'SleepSession',
      startTime: bedtime.toISOString(),
      endTime: wakeTime.toISOString(),
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
