// src/features/health/utils/stepColorUtils.ts
// Derives bar color and label based on steps / goal ratio.

export interface StepColorResult {
  /** Hex color for the bar fill */
  barColor: string;
  /** Hex color for the checkmark circle */
  dotColor: string;
  /** Human-readable label for the progress level */
  label: string;
  /** 0–1 progress ratio (capped at 1) */
  ratio: number;
}

/**
 * Five-stage color ramp that grows from muted → light-blue → teal → green
 * as the user's steps approach and exceed their daily goal.
 *
 * Stage thresholds (% of goal):
 *   0%        → no data / empty
 *   1–24%     → very light blue  (#A8D4F5)
 *   25–49%    → light blue       (#5AABF0)
 *   50–74%    → medium blue-teal (#2E9FD8)
 *   75–99%    → strong teal      (#1DB88A)
 *   100%+     → full green       (#16A34A)
 */
export function getStepColor(
  steps: number,
  goal: number,
  fallbackMuted: string,
  isToday: boolean,
): StepColorResult {
  if (goal <= 0) {
    return { barColor: fallbackMuted, dotColor: fallbackMuted, label: '—', ratio: 0 };
  }

  const ratio = steps / goal;

  if (steps === 0) {
    return {
      barColor: fallbackMuted,
      dotColor: fallbackMuted,
      label: 'No steps',
      ratio: 0,
    };
  }

  if (ratio >= 1) {
    return {
      barColor: '#16A34A',   // full green
      dotColor: '#16A34A',
      label: 'Goal reached!',
      ratio: 1,
    };
  }

  if (ratio >= 0.75) {
    return {
      barColor: '#1DB88A',   // strong teal-green
      dotColor: '#1DB88A',
      label: 'Almost there',
      ratio,
    };
  }

  if (ratio >= 0.5) {
    return {
      barColor: '#2E9FD8',   // medium blue-teal
      dotColor: '#2E9FD8',
      label: 'Halfway',
      ratio,
    };
  }

  if (ratio >= 0.25) {
    return {
      barColor: '#5AABF0',   // light blue
      dotColor: '#5AABF0',
      label: 'Getting started',
      ratio,
    };
  }

  // 1–24%
  return {
    barColor: isToday ? '#A8D4F5' : '#C5DFF7',  // very light blue
    dotColor: '#A8D4F5',
    label: 'Just started',
    ratio,
  };
}
