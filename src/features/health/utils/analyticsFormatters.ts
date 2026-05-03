// src/features/health/utils/analyticsFormatters.ts
// Pure formatting/calculation helpers shared across analytics components.

import { withOpacity } from '../../../utils/withOpacity';
import type { CalendarDay } from '../types/calendar.types';

// ─── Step formatting ──────────────────────────────────────────────────────────

/** Compact step count: 1200 → "1.2k", 1_500_000 → "1.5M" */
export function formatSteps(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

/** Signed change string: 6043 → "+6.0k", -9043 → "-9.0k" */
export function formatChange(n: number): string {
  const abs       = Math.abs(n);
  const formatted = abs >= 1_000 ? `${(abs / 1_000).toFixed(1)}k` : abs.toLocaleString();
  return `${n >= 0 ? '+' : '-'}${formatted}`;
}

/** Percentage change vs prior period: "+12%" or "-5%" */
export function pctChange(change: number, prev: number): string {
  if (!prev) return '—';
  const pct = Math.abs(Math.round((change / prev) * 100));
  return `${change >= 0 ? '+' : '-'}${pct}%`;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Short day label from a YYYY-MM-DD string without timezone shift */
export function toDayLabel(dateStr: string): string {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const [y, m, d] = dateStr.split('-').map(Number);
  return DAYS[new Date(y, m - 1, d).getDay()];
}

// ─── Calendar intensity ───────────────────────────────────────────────────────

/**
 * Maps a CalendarDay intensity (0–4) to a background color.
 * 0 = no data, 1–3 = low/med/high activity, 4 = goal met.
 */
export function intensityColor(
  intensity: CalendarDay['intensity'],
  primary: string,
  success: string,
  isDark: boolean,
): string {
  const base = isDark ? '#2a2a2a' : '#efefef';
  switch (intensity) {
    case 0:  return base;
    case 1:  return withOpacity(primary, 0.22);
    case 2:  return withOpacity(primary, 0.46);
    case 3:  return withOpacity(primary, 0.72);
    case 4:  return success;
    default: return base;
  }
}
