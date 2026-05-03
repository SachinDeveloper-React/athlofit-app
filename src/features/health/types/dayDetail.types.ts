// src/features/health/types/dayDetail.types.ts

export interface DayDetailResponse {
  date: string;          // "YYYY-MM-DD"
  dailyGoal: number;
  steps: number;
  calories: number;
  distance: number;      // km
  activeMinutes: number;
  heartRate: number;     // avg bpm
  heartRateMin: number;
  heartRateMax: number;
  hydration: number;     // ml
  sleepHours: number;
  bloodGlucose: number;  // mmol/L
  weight: number;        // kg
  goalMet: boolean;
  progressPct: number;   // 0–100
  intensity: 0 | 1 | 2 | 3 | 4;
  hasData: boolean;
}
