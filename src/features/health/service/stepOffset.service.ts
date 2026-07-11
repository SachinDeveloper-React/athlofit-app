// ─── stepOffset.service.ts ────────────────────────────────────────────────────
// Fetches today's synced health data from the server on login.
// This enables cross-device / reinstall continuity: if a user walked 2000 steps
// on device A, logged out, and logged into device B — device B starts from 2000.
// Also restores calories, distance, active minutes, and vitals from the server.

import { BASE_URL } from '../../../utils/api';
import { useHealthDataStore } from '../store/healthDataStore';
import { HealthData } from '../types/healthTypes';

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
  const { syncedStepOffset, syncedStepOffsetDate, syncedServerBaseline, syncedServerBaselineDate } = useHealthDataStore.getState();
  const today = new Date().toISOString().split('T')[0];

  if (syncedStepOffset > 0 && syncedStepOffsetDate && syncedStepOffsetDate !== today) {
    useHealthDataStore.getState().setSyncedStepOffset(0, '');
    console.log('[StepOffset] Cleared stale offset from', syncedStepOffsetDate);
  }

  if (syncedServerBaseline && syncedServerBaselineDate && syncedServerBaselineDate !== today) {
    useHealthDataStore.getState().setSyncedServerBaseline(null, '');
    console.log('[StepOffset] Cleared stale server baseline from', syncedServerBaselineDate);
  }
}

/**
 * Fetches today's health record from the server and stores:
 * 1. A step offset (server_steps - native_steps) for step continuity
 * 2. A full health data baseline (calories, distance, activeMinutes, vitals)
 *    so all metrics are restored after reinstall, not just steps.
 *
 * The step offset is added to the native sensor count so the user sees their
 * cumulative daily steps across devices.
 *
 * The health baseline provides floor values for all other metrics — the app
 * uses max(local, baseline) to ensure nothing drops below what was already
 * synced to the server.
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

    if (!response.ok) {
      // Mark as fetched even on failure so useHealth doesn't wait forever
      useHealthDataStore.getState().setStepOffsetFetched(true);
      return;
    }

    const json = await response.json();
    const record = json?.data;

    if (!record) {
      useHealthDataStore.getState().setStepOffsetFetched(true);
      return;
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Store the full server health baseline (calories, distance, activeMinutes,
    // heart rate, blood pressure, hydration, sleep, etc.) for cross-device/reinstall
    // continuity. useHealth will use max(local, baseline) for each metric.
    const serverBaseline: HealthData = {
      steps: record.steps || 0,
      calories: record.calories || 0,
      distance: record.distance || 0,
      activeMinutes: record.activeMinutes || 0,
      heartRate: record.heartRate || 0,
      heartRateMin: record.heartRateMin || 0,
      heartRateMax: record.heartRateMax || 0,
      bloodPressureSystolic: record.bloodPressureSystolic || 0,
      bloodPressureDiastolic: record.bloodPressureDiastolic || 0,
      sleepHours: record.sleepHours || 0,
      weight: record.weight || 0,
      bloodGlucose: record.bloodGlucose || 0,
      hydration: record.hydration || 0,
    };

    useHealthDataStore.getState().setSyncedServerBaseline(serverBaseline, today);

    // Step offset calculation (for native sensor real-time updates)
    if (typeof record.steps === 'number' && record.steps > 0) {
      const { stepService } = await import('../../../services/stepService');
      const currentNativeSteps = await stepService.getCurrentSteps();
      const offset = Math.max(0, record.steps - currentNativeSteps);

      if (offset > 0) {
        useHealthDataStore.getState().setSyncedStepOffset(offset, today);
        console.log(`[StepOffset] Server: ${record.steps}, native: ${currentNativeSteps}, offset: ${offset} for ${today}`);
      }
    }

    useHealthDataStore.getState().setStepOffsetFetched(true);

    console.log(`[StepOffset] Server baseline stored for ${today}:`, {
      steps: serverBaseline.steps,
      calories: serverBaseline.calories,
      distance: serverBaseline.distance,
      activeMinutes: serverBaseline.activeMinutes,
    });
  } catch (e) {
    console.warn('[StepOffset] Failed to fetch today step offset:', e);
    // Mark as fetched even on error so useHealth doesn't block indefinitely
    useHealthDataStore.getState().setStepOffsetFetched(true);
  }
}
