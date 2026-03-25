import AppleHealthKit, {
  HealthKitPermissions,
  HealthUnit,
  HealthValue,
} from 'react-native-health';
import { HealthData } from '../types/healthTypes';

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
    ],
    write: [
      AppleHealthKit.Constants.Permissions.Steps,
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.BloodPressureSystolic,
      AppleHealthKit.Constants.Permissions.BloodPressureDiastolic,
      AppleHealthKit.Constants.Permissions.BodyMass,
    ],
  },
};

export const initializeHealthKit = (): Promise<boolean> =>
  new Promise(resolve => {
    AppleHealthKit.initHealthKit(PERMISSIONS, error => {
      resolve(!error);
    });
  });

const todayRange = () => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return {
    startDate: startOfDay.toISOString(),
    endDate: new Date().toISOString(),
  };
};

// ─── Steps ──────────────────────────────────────────────────
export const getSteps = (): Promise<number> =>
  new Promise(resolve => {
    const options = { ...todayRange(), includeManuallyAdded: true };
    AppleHealthKit.getStepCount(options, (err, result) => {
      resolve(err ? 0 : Math.round(result.value));
    });
  });

// ─── Calories ───────────────────────────────────────────────
export const getCalories = (): Promise<number> =>
  new Promise(resolve => {
    AppleHealthKit.getActiveEnergyBurned(todayRange(), (err, results) => {
      if (err || !results?.length) return resolve(0);
      const total = results.reduce((sum, r) => sum + r.value, 0);
      resolve(Math.round(total));
    });
  });

// ─── Heart Rate ─────────────────────────────────────────────
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

// ─── Blood Pressure ─────────────────────────────────────────
export const getBloodPressure = (): Promise<{
  systolic: number;
  diastolic: number;
}> =>
  new Promise(resolve => {
    const range = {
      startDate: new Date(Date.now() - 7 * 86400000).toISOString(),
      endDate: new Date().toISOString(),
    };
    // HealthKit returns systolic & diastolic as separate sample types
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

// ─── Sleep ──────────────────────────────────────────────────
export const getSleep = (): Promise<number> =>
  new Promise(resolve => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(18, 0, 0, 0);

    AppleHealthKit.getSleepSamples(
      { startDate: yesterday.toISOString(), endDate: new Date().toISOString() },
      (err, results) => {
        if (err || !results?.length) return resolve(0);
        // Filter only "Asleep" states (value === 1)
        const asleep = results.filter(
          r => (r.value as unknown as string) === 'ASLEEP',
        );
        const totalMs = asleep.reduce((sum, r) => {
          return (
            sum +
            (new Date(r.endDate).getTime() - new Date(r.startDate).getTime())
          );
        }, 0);
        resolve(Math.round((totalMs / 3600000) * 10) / 10);
      },
    );
  });

// ─── Distance ───────────────────────────────────────────────
export const getDistance = (): Promise<number> =>
  new Promise(resolve => {
    AppleHealthKit.getDistanceWalkingRunning(
      { ...todayRange(), unit: 'km' },
      (err, result) => {
        resolve(err ? 0 : Math.round(result.value * 100) / 100);
      },
    );
  });

// ─── Weight ─────────────────────────────────────────────────
export const getWeight = (): Promise<number> =>
  new Promise(resolve => {
    AppleHealthKit.getLatestWeight({ unit: 'g' }, (err, result) => {
      if (err) return resolve(0);
      resolve(Math.round((result.value / 1000) * 10) / 10); // grams → kg
    });
  });

// ─── Blood Glucose ──────────────────────────────────────────
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

// ─── Fetch All ──────────────────────────────────────────────
export const fetchAllHealthKitData = async (): Promise<HealthData> => {
  const [steps, calories, hr, bp, sleepHours, distance, weight, bloodGlucose] =
    await Promise.all([
      getSteps(),
      getCalories(),
      getHeartRate(),
      getBloodPressure(),
      getSleep(),
      getDistance(),
      getWeight(),
      getBloodGlucose(),
    ]);

  return {
    steps,
    calories,
    heartRate: hr.avg,
    heartRateMin: hr.min,
    heartRateMax: hr.max,
    bloodPressureSystolic: bp.systolic,
    bloodPressureDiastolic: bp.diastolic,
    sleepHours,
    distance,
    weight,
    bloodGlucose,
  };
};

// ─── Write helpers ──────────────────────────────────────────
export const writeStepsHK = (count: number, date: Date) =>
  new Promise<void>((resolve, reject) => {
    AppleHealthKit.saveSteps({ value: count }, err => {
      err ? reject(err) : resolve();
    });
  });

export const writeWeightHK = (kg: number, date: Date) =>
  new Promise<void>((resolve, reject) => {
    AppleHealthKit.saveWeight(
      { value: kg * 1000, unit: 'gram', date: date.toISOString() },
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
        unit: 'literPerMinute',
        date: date.toISOString(),
      },
      err => {
        err ? reject(err) : resolve();
      },
    );
  });
