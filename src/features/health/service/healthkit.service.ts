import AppleHealthKit, {
  HealthKitPermissions,
  HealthUnit,
} from 'react-native-health';
import { HealthData } from '../types/healthTypes';

// ─── Derivation helper (mirrors healthConnect.service.ts) ─────────────────────
const STEPS_PER_MINUTE = 100;
const deriveActiveMinutes = (steps: number) =>
  Math.round(steps / STEPS_PER_MINUTE);

// ─── Permissions ──────────────────────────────────────────────────────────────
const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Steps,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.BloodPressureSystolic,
      AppleHealthKit.Constants.Permissions.BloodPressureDiastolic,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
      AppleHealthKit.Constants.Permissions.BodyMass,
      AppleHealthKit.Constants.Permissions.BloodGlucose,
      AppleHealthKit.Constants.Permissions.Water, // ✅ WaterConsumption → Water
    ],
    write: [
      AppleHealthKit.Constants.Permissions.Steps,
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.BloodPressureSystolic,
      AppleHealthKit.Constants.Permissions.BloodPressureDiastolic,
      AppleHealthKit.Constants.Permissions.BodyMass,
      AppleHealthKit.Constants.Permissions.BloodGlucose, // ✅ added
      AppleHealthKit.Constants.Permissions.SleepAnalysis, // ✅ added
      AppleHealthKit.Constants.Permissions.Water, // ✅ added
    ],
  },
};

// ─── Init ─────────────────────────────────────────────────────────────────────
export const initializeHealthKit = (): Promise<boolean> =>
  new Promise(resolve => {
    AppleHealthKit.initHealthKit(PERMISSIONS, error => {
      resolve(!error);
    });
  });

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
export const getSteps = (): Promise<number> =>
  new Promise(resolve => {
    const options = { ...todayRange(), includeManuallyAdded: true };
    AppleHealthKit.getStepCount(options, (err, result) => {
      resolve(err ? 0 : Math.round(result.value));
    });
  });

// ─── Calories ───────────────────────────────────────────────────────────────
export const getCalories = (): Promise<number> =>
  new Promise(resolve => {
    AppleHealthKit.getActiveEnergyBurned(todayRange(), (err, results) => {
      if (err || !results?.length) return resolve(0);
      const total = results.reduce((sum, r) => sum + r.value, 0);
      resolve(Math.round(total));
    });
  });

// ─── Heart Rate ─────────────────────────────────────────────────────────────
export const getHeartRate = (): Promise<{
  avg: number;
  min: number;
  max: number;
}> =>
  new Promise(resolve => {
    AppleHealthKit.getHeartRateSamples(todayRange(), (err, results) => {
      if (err || !results?.length) return resolve({ avg: 0, min: 0, max: 0 });
      const bpms = results.map(r => r.value);
      resolve({
        avg: Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length),
        min: Math.min(...bpms),
        max: Math.max(...bpms),
      });
    });
  });

// ─── Blood Pressure ─────────────────────────────────────────────────────────
export const getBloodPressure = (): Promise<{
  systolic: number;
  diastolic: number;
}> =>
  new Promise(resolve => {
    const range = {
      startDate: new Date(Date.now() - 7 * 86400000).toISOString(),
      endDate: new Date().toISOString(),
    };
    AppleHealthKit.getBloodPressureSamples(range, (err, results) => {
      if (err || !results?.length)
        return resolve({ systolic: 0, diastolic: 0 });
      const latest = results[results.length - 1];
      resolve({
        systolic: Math.round(latest.bloodPressureSystolicValue),
        diastolic: Math.round(latest.bloodPressureDiastolicValue),
      });
    });
  });

// ─── Sleep ──────────────────────────────────────────────────────────────────
export const getSleep = (): Promise<number> =>
  new Promise(resolve => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(18, 0, 0, 0);

    AppleHealthKit.getSleepSamples(
      { startDate: yesterday.toISOString(), endDate: new Date().toISOString() },
      (err, results) => {
        if (err || !results?.length) return resolve(0);
        const asleep = results.filter(
          r => (r.value as unknown as string) === 'ASLEEP',
        );
        const totalMs = asleep.reduce(
          (sum, r) =>
            sum +
            (new Date(r.endDate).getTime() - new Date(r.startDate).getTime()),
          0,
        );
        resolve(Math.round((totalMs / 3600000) * 10) / 10);
      },
    );
  });

// ─── Distance ───────────────────────────────────────────────────────────────
export const getDistance = (): Promise<number> =>
  new Promise(resolve => {
    // ✅ 'kilometer' is the correct HealthUnit — 'km' is not in the union
    AppleHealthKit.getDistanceWalkingRunning(
      { ...todayRange(), unit: 'kilometer' as HealthUnit },
      (err, result) => {
        resolve(err ? 0 : Math.round(result.value * 100) / 100);
      },
    );
  });

// ─── Weight ─────────────────────────────────────────────────────────────────
export const getWeight = (): Promise<number> =>
  new Promise(resolve => {
    AppleHealthKit.getLatestWeight(
      { unit: 'gram' as HealthUnit },
      (err, result) => {
        if (err) return resolve(0);
        resolve(Math.round((result.value / 1000) * 10) / 10); // grams → kg
      },
    );
  });

// ─── Blood Glucose ──────────────────────────────────────────────────────────
export const getBloodGlucose = (): Promise<number> =>
  new Promise(resolve => {
    const range = {
      startDate: new Date(Date.now() - 24 * 86400000).toISOString(),
      endDate: new Date().toISOString(),
    };
    AppleHealthKit.getBloodGlucoseSamples(range, (err, results) => {
      if (err || !results?.length) return resolve(0);
      const latest = results[results.length - 1];
      resolve(Math.round(latest.value * 10) / 10);
    });
  });

// ─── Hydration ──────────────────────────────────────────────────────────────
export const getHydration = (): Promise<number> =>
  new Promise(resolve => {
    AppleHealthKit.getWaterSamples(
      { ...todayRange(), unit: 'ml' as HealthUnit },
      (err, results) => {
        if (err || !results?.length) return resolve(0);
        const totalMl = results.reduce((sum, r) => sum + r.value, 0);
        resolve(Math.round(totalMl));
      },
    );
  });

// ─── Fetch All ──────────────────────────────────────────────────────────────
export const fetchAllHealthKitData = async (): Promise<HealthData> => {
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
    getHydration(), // ✅ added
  ]);

  return {
    steps,
    calories,
    distance,
    activeMinutes: deriveActiveMinutes(steps), // ✅ added
    heartRate: hr.avg,
    heartRateMin: hr.min,
    heartRateMax: hr.max,
    bloodPressureSystolic: bp.systolic,
    bloodPressureDiastolic: bp.diastolic,
    sleepHours,
    weight,
    bloodGlucose,
    hydration, // ✅ added
  };
};

// ─── Write helpers ──────────────────────────────────────────────────────────

export const writeStepsHK = (count: number, _date: Date) =>
  new Promise<void>((resolve, reject) => {
    AppleHealthKit.saveSteps({ value: count }, err => {
      err ? reject(err) : resolve();
    });
  });

export const writeWeightHK = (kg: number, date: Date) =>
  new Promise<void>((resolve, reject) => {
    AppleHealthKit.saveWeight(
      { value: kg * 1000, unit: 'gram' as HealthUnit, date: date.toISOString() } as any,
      err => {
        err ? reject(err) : resolve();
      },
    );
  });

export const writeHydrationHK = (ml: number, date: Date) =>
  new Promise<void>((resolve, reject) => {
    AppleHealthKit.saveWater(
      {
        value: ml,
        unit: 'ml' as HealthUnit, // ✅ fixed: was 'literPerMinute'
        date: date.toISOString(),
      } as any,
      err => {
        err ? reject(err) : resolve();
      },
    );
  });

// ✅ Write heart rate to HealthKit
export const writeHeartRateHK = (bpm: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const now = new Date();
    const start = new Date(now.getTime() - 60_000);
    AppleHealthKit.saveHeartRateSample(
      {
        value: bpm,
        startDate: start.toISOString(),
        endDate: now.toISOString(),
      },
      err => {
        err ? reject(err) : resolve();
      },
    );
  });

// ✅ Write blood pressure to HealthKit
// Note: `saveBloodPressureSample` exists at runtime but is not yet typed in
// the @types — casting via `as any` until the library types catch up.
export const writeBloodPressureHK = (
  systolic: number,
  diastolic: number,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    (AppleHealthKit as any).saveBloodPressureSample(
      {
        systolicBloodPressure: systolic,
        diastolicBloodPressure: diastolic,
        startDate: now,
        endDate: now,
      },
      (err: any) => {
        err ? reject(err) : resolve();
      },
    );
  });

// ✅ Write blood glucose to HealthKit
export const writeBloodGlucoseHK = (mmol: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    // HealthUnit 'mmoL/L' is the correct value for mmol/L
    AppleHealthKit.saveBloodGlucoseSample(
      {
        value: mmol,
        unit: 'mmoL/L' as HealthUnit,
        startDate: now,
        endDate: now,
      },
      err => {
        err ? reject(err) : resolve();
      },
    );
  });

// ✅ Write sleep session to HealthKit
// Note: `saveSleepSamples` exists at runtime but is not typed — casting via
// `as any` until the library types catch up.
export const writeSleepHK = (bedtime: Date, wakeTime: Date): Promise<void> =>
  new Promise((resolve, reject) => {
    (AppleHealthKit as any).saveSleepSamples(
      {
        value: 'ASLEEP',
        startDate: bedtime.toISOString(),
        endDate: wakeTime.toISOString(),
      },
      (err: any) => {
        err ? reject(err) : resolve();
      },
    );
  });
