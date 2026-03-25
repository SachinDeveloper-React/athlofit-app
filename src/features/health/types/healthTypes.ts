import { ApiResponse } from '../../../types/auth.types';

export interface HealthData {
  steps: number;
  calories: number; // kcal — derived from steps
  distance: number; // km   — derived from steps
  activeMinutes: number; // min  — derived from steps
  heartRate: number;
  heartRateMin: number;
  heartRateMax: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  sleepHours: number;
  weight: number; // kg
  bloodGlucose: number; // mmol/L
  hydration: number; // mmol/L
}

export const defaultHealthData: HealthData = {
  steps: 0,
  calories: 0,
  distance: 0,
  activeMinutes: 0,
  heartRate: 0,
  heartRateMin: 0,
  heartRateMax: 0,
  bloodPressureSystolic: 0,
  bloodPressureDiastolic: 0,
  sleepHours: 0,
  weight: 0,
  bloodGlucose: 0,
  hydration: 0,
};

// ─── Weekly Steps ─────────────────────────────────────────────────────────────

export type WeeklyStepEntry = {
  date: string;
  steps: number;
};

export type WeeklyStepsRequest = {
  from: string; // ISO: YYYY-MM-DD
  to: string; // ISO: YYYY-MM-DD
};

export type WeeklyStepsResponse = ApiResponse<WeeklyStepEntry[]>;
