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
//  READ Steps   — reads the steps that Android's built-in step counter writes
//  WRITE Calories / Distance / ExerciseSession — we write derived values back
//
const PERMISSIONS: (Permission | BackgroundAccessPermission)[] = [
  // Activity
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'write', recordType: 'Distance' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'write', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'write', recordType: 'ExerciseSession' },
  // Vitals
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'write', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'BloodPressure' },
  { accessType: 'write', recordType: 'BloodPressure' },
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'write', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'write', recordType: 'Weight' },
  { accessType: 'read', recordType: 'Height' },
  { accessType: 'write', recordType: 'Height' },
  { accessType: 'read', recordType: 'BloodGlucose' },
  { accessType: 'write', recordType: 'BloodGlucose' },
  { accessType: 'read', recordType: 'Hydration' },
  { accessType: 'write', recordType: 'Hydration' },
  // Background
  { accessType: 'read', recordType: 'BackgroundAccessPermission' },
];

// ─── Init ─────────────────────────────────────────────────────────────────────

export const isHealthConnectAvailable = async (): Promise<boolean> => {
  const status = await getSdkStatus();
  return status === SdkAvailabilityStatus.SDK_AVAILABLE;
};

export const initializeHealthConnect = async (): Promise<boolean> => {
  const initialized = await initialize();
  if (!initialized) return false;
  const granted = await requestPermission(PERMISSIONS);
  // Accept if at least 80% of permissions were granted
  return granted.length >= PERMISSIONS.length * 0.8;
};

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
): Promise<HealthData> => {
  try {
    const [
      stepsRecords,
      calRecords,
      distRecords,
      hrRecords,
      bpRecords,
      sleepRecords,
      weightRecords,
      glucoseRecords,
      hydrationRecord,
    ] = await Promise.all([
      // Steps — read from Android built-in step sensor via Health Connect
      readRecords('Steps', { timeRangeFilter: todayRange() }).catch(e => {
        console.warn('Steps read failed:', e);
        return { records: [] };
      }),

      readRecords('ActiveCaloriesBurned', {
        timeRangeFilter: todayRange(),
      }).catch(e => {
        console.warn('Calories read failed:', e);
        return { records: [] };
      }),

      readRecords('Distance', { timeRangeFilter: todayRange() }).catch(e => {
        console.warn('Distance read failed:', e);
        return { records: [] };
      }),

      readRecords('HeartRate', { timeRangeFilter: todayRange() }).catch(e => {
        console.warn('HeartRate read failed:', e);
        return { records: [] };
      }),

      readRecords('BloodPressure', { timeRangeFilter: lastNDays(7) }).catch(
        e => {
          console.warn('BloodPressure read failed:', e);
          return { records: [] };
        },
      ),

      readRecords('SleepSession', { timeRangeFilter: lastNDays(1) }).catch(
        e => {
          console.warn('Sleep read failed:', e);
          return { records: [] };
        },
      ),

      readRecords('Weight', { timeRangeFilter: lastNDays(30) }).catch(e => {
        console.warn('Weight read failed:', e);
        return { records: [] };
      }),

      readRecords('BloodGlucose', { timeRangeFilter: lastNDays(1) }).catch(
        e => {
          console.warn('BloodGlucose read failed:', e);
          return { records: [] };
        },
      ),
      readRecords('Hydration', { timeRangeFilter: todayRange() }).catch(e => {
        console.warn('Hydration read failed:', e);
        return { records: [] };
      }),
    ]);

    // ── Steps: sum all Step records for today ──────────────────────────────
    //    Android's built-in sensor (TYPE_STEP_COUNTER) writes these
    //    automatically — no third-party app or library needed on Android 15.
    const steps = stepsRecords.records.reduce(
      (sum, r) => sum + (r.count ?? 0),
      0,
    );

    // ── Derive calories / distance / activeMinutes from steps ──────────────
    //    Use stored values if they already exist (written by a previous call
    //    to writeDerivedActivity), otherwise fall back to the formula.
    const storedCalories = Math.round(
      calRecords.records.reduce(
        (sum, r) => sum + (r.energy?.inKilocalories ?? 0),
        0,
      ),
    );
    const storedDistance =
      Math.round(
        distRecords.records.reduce(
          (sum, r) => sum + (r.distance?.inKilometers ?? 0),
          0,
        ) * 100,
      ) / 100;

    const derived = deriveFromSteps(steps, weightKg);
    const calories = storedCalories > 0 ? storedCalories : derived.calories;
    const distance = storedDistance > 0 ? storedDistance : derived.distanceKm;
    const activeMinutes = derived.activeMinutes; // always recompute from steps

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

export const writeStepsHC = async (
  count: number,
  start: Date,
  end: Date,
): Promise<void> => {
  await insertRecords([
    {
      recordType: 'Steps',
      count,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    },
  ]);
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
