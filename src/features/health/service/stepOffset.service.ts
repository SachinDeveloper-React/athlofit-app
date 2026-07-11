// ─── stepOffset.service.ts ────────────────────────────────────────────────────
// Fetches today's synced step count from the server on login.
// This enables cross-device step continuity: if a user walked 2000 steps on
// device A, logged out, and logged into device B — device B starts from 2000.

import { BASE_URL } from '../../../utils/api';
import { useHealthDataStore } from '../store/healthDataStore';

/**
 * FIX #9: Clears the synced step offset if it belongs to a previous day.
 * Call this on app launch (before health data loads) to prevent yesterday's
 * offset from briefly inflating today's step count during the window between
 * app launch and the first server fetch.
 *
 * The existing date guard (syncedStepOffsetDate === today) in useHealth already
 * prevents stale offsets from being *used*, but this eagerly clears the stored
 * value so there's zero ambiguity.
 */
export function clearStaleStepOffset(): void {
  const { syncedStepOffset, syncedStepOffsetDate } = useHealthDataStore.getState();
  if (syncedStepOffset <= 0) return;

  const today = new Date().toISOString().split('T')[0];
  if (syncedStepOffsetDate && syncedStepOffsetDate !== today) {
    useHealthDataStore.getState().setSyncedStepOffset(0, '');
    console.log('[StepOffset] Cleared stale offset from', syncedStepOffsetDate);
  }
}

/**
 * Fetches today's health record from the server and stores the step count
 * as a synced offset. This offset is added to the native sensor count so
 * the user sees their cumulative daily steps across devices.
 *
 * The offset = server_steps - current_native_steps, ensuring we don't
 * double-count steps that this device already contributed to the server total.
 *
 * Only sets the offset if the server has a record for today with steps > 0.
 */
export async function fetchAndStoreTodayStepOffset(accessToken: string): Promise<void> {
  // FIX #9: Always clear stale offset first before fetching fresh one
  clearStaleStepOffset();

  try {
    const response = await fetch(`${BASE_URL}health/today`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) return;

    const json = await response.json();
    const record = json?.data;

    if (!record || typeof record.steps !== 'number' || record.steps <= 0) {
      return;
    }

    // Get current native sensor steps to avoid double-counting.
    // If user did 500 steps on this device and server shows 2500 (which includes
    // those 500), the offset should be 2500 - 500 = 2000 (steps from other devices).
    const { stepService } = await import('../../../services/stepService');
    const currentNativeSteps = await stepService.getCurrentSteps();
    const offset = Math.max(0, record.steps - currentNativeSteps);

    if (offset <= 0) return;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Store the offset (steps from other devices today)
    useHealthDataStore.getState().setSyncedStepOffset(offset, today);

    console.log(`[StepOffset] Server: ${record.steps}, native: ${currentNativeSteps}, offset: ${offset} for ${today}`);
  } catch (e) {
    console.warn('[StepOffset] Failed to fetch today step offset:', e);
  }
}
