import { NativeModules } from 'react-native';
import { HealthData, defaultHealthData } from '../types/healthTypes';

// ─── Native Module ────────────────────────────────────────────────────────────
// Custom native module that uses Promises (works with RN 0.84 New Architecture).
// react-native-health's AppleHealthKit module doesn't load under bridgeless mode.
const HK = NativeModules.HealthKitAuth;

const isHealthKitAvailable = !!HK;

// ─── Derivation helper (mirrors healthConnect.service.ts) ─────────────────────
const STEPS_PER_MINUTE = 100;
const deriveActiveMinutes = (steps: number) =>
  Math.round(steps / STEPS_PER_MINUTE);

// ─── Init ─────────────────────────────────────────────────────────────────────
export const initializeHealthKit = async (): Promise<boolean> => {
  if (!isHealthKitAvailable) {
    console.log('[HealthKit] Native module not available');
    return false;
  }
  try {
    const result = await HK.requestAuthorization();
    return !!result;
  } catch (e) {
    console.log('[HealthKit] requestAuthorization error:', e);
    return false;
  }
};

// ─── Time helpers ──────────────────────────────────────────────────────────────
const todayRange = () => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return {
    startDate: startOfDay.toISOString(),
    endDate: new Date().toISOString(),
  };
};

// ─── Steps ──────────────────────────────────────────────────────────────────

export const getStepsForRange = async (
  startDate: string,
  endDate: string,
): Promise<number> => {
  if (!isHealthKitAvailable) return 0;
  try {
    const steps = await HK.getStepCount(startDate, endDate);
    return Math.round(steps);
  } catch {
    return 0;
  }
};

export const getSteps = async (): Promise<number> => {
  if (!isHealthKitAvailable) return 0;
  const { startDate, endDate } = todayRange();
  try {
    const steps = await HK.getStepCount(startDate, endDate);
    return Math.round(steps);
  } catch {
    return 0;
  }
};

// ─── Calories ───────────────────────────────────────────────────────────────
export const getCalories = async (): Promise<number> => {
  if (!isHealthKitAvailable) return 0;
  const { startDate, endDate } = todayRange();
  try {
    const cal = await HK.getActiveEnergyBurned(startDate, endDate);
    return Math.round(cal);
  } catch {
    return 0;
  }
};

// ─── Heart Rate ─────────────────────────────────────────────────────────────
export const getHeartRate = async (): Promise<{
  avg: number;
  min: number;
  max: number;
}> => {
  if (!isHealthKitAvailable) return { avg: 0, min: 0, max: 0 };
  const { startDate, endDate } = todayRange();
  try {
    const result = await HK.getHeartRateSamples(startDate, endDate);
    return {
      avg: Math.round(result.avg || 0),
      min: Math.round(result.min || 0),
      max: Math.round(result.max || 0),
    };
  } catch {
    return { avg: 0, min: 0, max: 0 };
  }
};

// ─── Blood Pressure ─────────────────────────────────────────────────────────
export const getBloodPressure = async (): Promise<{
  systolic: number;
  diastolic: number;
}> => {
  if (!isHealthKitAvailable) return { systolic: 0, diastolic: 0 };
  const range = {
    startDate: new Date(Date.now() - 7 * 86400000).toISOString(),
    endDate: new Date().toISOString(),
  };
  try {
    const result = await HK.getBloodPressureSamples(range.startDate, range.endDate);
    return {
      systolic: Math.round(result.systolic || 0),
      diastolic: Math.round(result.diastolic || 0),
    };
  } catch {
    return { systolic: 0, diastolic: 0 };
  }
};

// ─── Sleep ──────────────────────────────────────────────────────────────────
export const getSleep = async (): Promise<number> => {
  if (!isHealthKitAvailable) return 0;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(18, 0, 0, 0);
  try {
    const hours = await HK.getSleepSamples(
      yesterday.toISOString(),
      new Date().toISOString(),
    );
    return Math.round((hours as number) * 10) / 10;
  } catch {
    return 0;
  }
};

// ─── Distance ───────────────────────────────────────────────────────────────
export const getDistance = async (): Promise<number> => {
  if (!isHealthKitAvailable) return 0;
  const { startDate, endDate } = todayRange();
  try {
    const km = await HK.getDistanceWalkingRunning(startDate, endDate);
    return Math.round((km as number) * 100) / 100;
  } catch {
    return 0;
  }
};

// ─── Weight ─────────────────────────────────────────────────────────────────
export const getWeight = async (): Promise<number> => {
  if (!isHealthKitAvailable) return 0;
  try {
    const kg = await HK.getLatestWeight();
    return Math.round((kg as number) * 10) / 10;
  } catch {
    return 0;
  }
};

// ─── Blood Glucose ──────────────────────────────────────────────────────────
export const getBloodGlucose = async (): Promise<number> => {
  if (!isHealthKitAvailable) return 0;
  const range = {
    startDate: new Date(Date.now() - 24 * 86400000).toISOString(),
    endDate: new Date().toISOString(),
  };
  try {
    const val = await HK.getBloodGlucoseSamples(range.startDate, range.endDate);
    return Math.round((val as number) * 10) / 10;
  } catch {
    return 0;
  }
};

// ─── Hydration ──────────────────────────────────────────────────────────────
export const getHydration = async (): Promise<number> => {
  if (!isHealthKitAvailable) return 0;
  const { startDate, endDate } = todayRange();
  try {
    const ml = await HK.getWaterSamples(startDate, endDate);
    return Math.round(ml as number);
  } catch {
    return 0;
  }
};

// ─── Fetch All ──────────────────────────────────────────────────────────────
export const fetchAllHealthKitData = async (): Promise<HealthData> => {
  if (!isHealthKitAvailable) return defaultHealthData;

  const [
    steps,
    calories,
    hr,
    bp,
    sleepHours,
    distance,
    weight,
    bloodGlucose,
    hydration,
  ] = await Promise.all([
    getSteps(),
    getCalories(),
    getHeartRate(),
    getBloodPressure(),
    getSleep(),
    getDistance(),
    getWeight(),
    getBloodGlucose(),
    getHydration(),
  ]);

  return {
    steps,
    calories,
    distance,
    activeMinutes: deriveActiveMinutes(steps),
    heartRate: hr.avg,
    heartRateMin: hr.min,
    heartRateMax: hr.max,
    bloodPressureSystolic: bp.systolic,
    bloodPressureDiastolic: bp.diastolic,
    sleepHours,
    weight,
    bloodGlucose,
    hydration,
  };
};

/**
 * Fetch HealthKit data for a specific time window.
 */
export const fetchHealthKitDataForRange = async (
  startDate: string,
  endDate: string,
): Promise<HealthData> => {
  const steps = await getStepsForRange(startDate, endDate);
  const calories = Math.round(steps * (70 * 0.57) / 1000);
  const distance = Math.round(steps * (0.76 / 1000) * 100) / 100;
  const activeMinutes = Math.round(steps / STEPS_PER_MINUTE);

  const [hr, bp, sleepHours, weight, bloodGlucose, hydration] =
    await Promise.all([
      getHeartRate(),
      getBloodPressure(),
      getSleep(),
      getWeight(),
      getBloodGlucose(),
      getHydration(),
    ]);

  return {
    steps,
    calories,
    distance,
    activeMinutes,
    heartRate: hr.avg,
    heartRateMin: hr.min,
    heartRateMax: hr.max,
    bloodPressureSystolic: bp.systolic,
    bloodPressureDiastolic: bp.diastolic,
    sleepHours,
    weight,
    bloodGlucose,
    hydration,
  };
};

// ─── Write helpers ──────────────────────────────────────────────────────────

export const writeStepsHK = async (count: number, _date: Date): Promise<void> => {
  if (!isHealthKitAvailable) return;
  await HK.saveSteps(count);
};

export const writeWeightHK = async (kg: number, date: Date): Promise<void> => {
  if (!isHealthKitAvailable) return;
  await HK.saveWeight(kg, date.toISOString());
};

export const writeHydrationHK = async (ml: number, date: Date): Promise<void> => {
  if (!isHealthKitAvailable) return;
  await HK.saveWater(ml, date.toISOString());
};

export const writeHeartRateHK = async (bpm: number): Promise<void> => {
  if (!isHealthKitAvailable) return;
  await HK.saveHeartRate(bpm);
};

export const writeBloodPressureHK = async (
  systolic: number,
  diastolic: number,
): Promise<void> => {
  if (!isHealthKitAvailable) return;
  await HK.saveBloodPressure(systolic, diastolic);
};

export const writeBloodGlucoseHK = async (mmol: number): Promise<void> => {
  if (!isHealthKitAvailable) return;
  await HK.saveBloodGlucose(mmol);
};

export const writeSleepHK = async (
  bedtime: Date,
  wakeTime: Date,
): Promise<void> => {
  if (!isHealthKitAvailable) return;
  await HK.saveSleep(bedtime.toISOString(), wakeTime.toISOString());
};
