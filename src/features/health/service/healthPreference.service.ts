// ─── healthPreference.service.ts ──────────────────────────────────────────────
// Persists the user's health platform preference using MMKV.
// Tracks whether the user has:
// - 'connected': granted Health Connect / HealthKit permissions
// - 'skipped': chose to use native step sensor only (no HC/HK)
// - null: hasn't made a choice yet (first launch — show permission screen)

import { mmkv } from '../../../store';

const PREF_KEY = 'health_platform_preference';

export type HealthPreferenceChoice = 'connected' | 'skipped';

/**
 * Get the user's stored health platform preference.
 * Returns null if no choice has been made yet (first launch).
 */
export function getHealthPreference(): HealthPreferenceChoice | null {
  const value = mmkv.getString(PREF_KEY);
  if (value === 'connected' || value === 'skipped') return value;
  return null;
}

/**
 * Save the user's health platform preference.
 * - 'connected': user granted Health Connect / HealthKit permissions
 * - 'skipped': user chose to continue with native step sensor only
 */
export function setHealthPreference(choice: HealthPreferenceChoice): void {
  mmkv.set(PREF_KEY, choice);
}

/**
 * Clear the health preference (e.g., on logout or when user wants to re-connect).
 * Next launch will show the permission screen again.
 */
export function clearHealthPreference(): void {
  mmkv.remove(PREF_KEY);
}
