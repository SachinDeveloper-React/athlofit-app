// src/features/health/types/calendar.types.ts

export interface CalendarDay {
  date: string;      // "YYYY-MM-DD"
  steps: number;
  goalMet: boolean;
  intensity: 0 | 1 | 2 | 3 | 4; // 0=none, 1=low, 2=med, 3=high, 4=goal
}

export interface AvailableMonth {
  year: number;
  month: number;   // 1-based
  label: string;   // "January 2025"
}

export interface CalendarActivityResponse {
  year: number;
  month: number;
  dailyGoal: number;
  completedDays: number;
  activeDays: number;
  totalDays: number;
  days: CalendarDay[];
  availableMonths: AvailableMonth[];
}
