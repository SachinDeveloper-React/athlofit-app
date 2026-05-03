// src/features/health/types/periodStats.types.ts

export interface PeriodStat {
  label: string;      // "7 Days" | "14 Days" | "30 Days"
  days: number;
  totalSteps: number;
  change: number;     // absolute diff vs prior equivalent period (can be negative)
  prevTotal: number;
}

export interface PeriodStatsResponse {
  periods: PeriodStat[];
}
