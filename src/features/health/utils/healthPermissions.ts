/**
 * healthPermissions.ts
 *
 * Canonical reference of every health metric the app uses, mapped to its
 * permission identifier on each platform. This file is documentation-only;
 * the actual permission arrays live in healthkit.service.ts (iOS) and
 * healthConnect.service.ts (Android).
 *
 * When adding a NEW metric:
 *  1. Add it here so it's visible in one place
 *  2. Add the read/write permission to BOTH service files
 *  3. Add the field to HealthData in healthTypes.ts
 *  4. Implement getXxx() / writeXxx() in BOTH service files
 *  5. Wire up in useHealth.ts (loadData + logXxx)
 */

export interface HealthPermissionEntry {
  metric: string;
  healthKit: string; // AppleHealthKit.Constants.Permissions key
  healthConnect: string; // react-native-health-connect recordType
  access: ('read' | 'write')[];
  notes?: string;
}

export const HEALTH_PERMISSIONS: HealthPermissionEntry[] = [
  // ─── Activity ─────────────────────────────────────────────────────────────
  {
    metric: 'Steps',
    healthKit: 'Steps',
    healthConnect: 'Steps',
    access: ['read', 'write'],
  },
  {
    metric: 'Active Calories',
    healthKit: 'ActiveEnergyBurned',
    healthConnect: 'ActiveCaloriesBurned',
    access: ['read', 'write'],
  },
  {
    metric: 'Distance (Walking/Running)',
    healthKit: 'DistanceWalkingRunning',
    healthConnect: 'Distance',
    access: ['read', 'write'],
  },
  {
    metric: 'Exercise / Active Minutes',
    healthKit: 'AppleExerciseTime',
    healthConnect: 'ExerciseSession',
    access: ['read', 'write'],
    notes: 'Derived from steps on Android; AppleExerciseTime on iOS.',
  },

  // ─── Vitals ───────────────────────────────────────────────────────────────
  {
    metric: 'Heart Rate',
    healthKit: 'HeartRate',
    healthConnect: 'HeartRate',
    access: ['read', 'write'],
  },
  {
    metric: 'Blood Pressure',
    healthKit: 'BloodPressureSystolic + BloodPressureDiastolic',
    healthConnect: 'BloodPressure',
    access: ['read', 'write'],
  },
  {
    metric: 'Blood Glucose',
    healthKit: 'BloodGlucose',
    healthConnect: 'BloodGlucose',
    access: ['read', 'write'],
    notes: 'Unit: mmol/L',
  },
  {
    metric: 'Body Weight',
    healthKit: 'BodyMass',
    healthConnect: 'Weight',
    access: ['read', 'write'],
    notes: 'Unit: kg. HealthKit stores in grams; convert on read/write.',
  },

  // ─── Sleep ────────────────────────────────────────────────────────────────
  {
    metric: 'Sleep',
    healthKit: 'SleepAnalysis',
    healthConnect: 'SleepSession',
    access: ['read', 'write'],
  },

  // ─── Hydration ────────────────────────────────────────────────────────────
  {
    metric: 'Hydration (Water)',
    healthKit: 'WaterConsumption',
    healthConnect: 'Hydration',
    access: ['read', 'write'],
    notes: 'Unit: ml. HealthKit stores in liters; Convert via value/1000.',
  },
];
