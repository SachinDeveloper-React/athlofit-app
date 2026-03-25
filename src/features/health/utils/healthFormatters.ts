import { DAY_NAMES } from '../constants/tracker.constant';
import { WeeklyStepEntry } from '../types/healthTypes';

export const getBPStatus = (sys: number, dia: number) => {
  if (!sys) return null;
  if (sys < 120 && dia < 80)
    return { label: 'Normal', color: '#3B6D11', bg: '#EAF3DE' };
  if (sys < 130) return { label: 'Elevated', color: '#854F0B', bg: '#FAEEDA' };
  if (sys < 140)
    return { label: 'High Stage 1', color: '#D85A30', bg: '#FAECE7' };
  return { label: 'High Stage 2', color: '#A32D2D', bg: '#FCEBEB' };
};

export const getHRZone = (bpm: number) => {
  if (!bpm) return null;
  if (bpm < 60) return { label: 'Low', color: '#185FA5', bg: '#E6F1FB' };
  if (bpm <= 100) return { label: 'Normal', color: '#3B6D11', bg: '#EAF3DE' };
  return { label: 'High', color: '#A32D2D', bg: '#FCEBEB' };
};

/** Returns an ISO date string (YYYY-MM-DD) for a given Date. */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Builds a DayData[] skeleton for the last 7 days (today = last entry),
 * all steps defaulting to 0. Used as the loading/fallback state.
 */
export function buildEmptyWeekData(): WeeklyStepEntry[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return { date: DAY_NAMES[d.getDay()], steps: 0 };
  });
}

export function getLast7DaysRange(): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 6);
  return { from: toISODate(from), to: toISODate(today) };
}

export const buildPreviousDaysFilter = () => {
  // Start: far past (1 year ago is safe enough)
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  start.setHours(0, 0, 0, 0);

  // End: yesterday at 23:59:59 (today is NOT included)
  const end = new Date();
  end.setDate(end.getDate() - 1);
  end.setHours(23, 59, 59, 999);

  return {
    operator: 'between' as const,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
};

export const buildTodayFilter = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return {
    operator: 'between' as const,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
};
