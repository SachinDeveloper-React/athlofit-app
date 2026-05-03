// src/features/health/types/mostActiveDay.types.ts

export interface WeekEntry {
  date: string;
  steps: number;
  dayLabel: string;
}

export interface MostActiveDayData {
  entries: WeekEntry[];
  peakIndex: number;
  peakEntry: WeekEntry | null;
  totalSteps: number;
  avgSteps: number;
}
