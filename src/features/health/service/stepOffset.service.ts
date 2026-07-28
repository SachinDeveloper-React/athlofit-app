// ─── stepOffset.service.ts ────────────────────────────────────────────────────
// Fetches today's synced health data from the server on login.
// This enables cross-device / reinstall continuity: if a user walked 2000 steps
// on device A, logged out, and logged into device B — device B starts from 2000.
// Also restores calories, distance, active minutes, and vitals from the server.

import { BASE_URL } from '../../../utils/api';
import { useHealthDataStore } from '../store/healthDataStore';
import { HealthData } from '../types/healthTypes';
import { getLocalToday } from '../../../utils/date';

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
  const today = getLocalToday();

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
    // Include device timezone so the server returns today's record based on
    // the user's local day boundary, not the server's IST timezone.
    const { getTimezone } = await import('../../../utils/timezone');
    const timezone = getTimezone() || '';
    const url = timezone
      ? `${BASE_URL}health/today?timezone=${encodeURIComponent(timezone)}`
      : `${BASE_URL}health/today`;

    const response = await fetch(url, {
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

    const today = getLocalToday(); // YYYY-MM-DD

    // Safety check: if the server returned a record for a different date
    // (possible if server/client clocks are slightly out of sync around midnight),
    // discard it to prevent yesterday's steps from leaking into today.
    if (record.date && record.date !== today) {
      console.warn(`[StepOffset] Server returned record for ${record.date} but local today is ${today} — discarding`);
      useHealthDataStore.getState().setStepOffsetFetched(true);
      return;
    }

    // ── Stale baseline guard ─────────────────────────────────────────────────
    // After a DB reset + re-login, a background sync might slip through and
    // create a server record with stale steps (from Health Connect's historical
    // data). Detect this by checking if the record's step count is unreasonably
    // high relative to time elapsed since login.
    // ── Stale baseline guard ─────────────────────────────────────────────────
    // Previously this rejected server baselines that seemed "too high for time
    // since login." However, the server legitimately accumulates steps from
    // before login (walked earlier today on the same or another device).
    // With loginTimestamp-based HC reading, the server baseline IS the pre-login
    // steps, and we ADD post-login HC steps on top. So we must NOT reject
    // the server baseline just because it's higher than post-login plausible.
    //
    // The inflation guard in useHealth (server > 2x local) and the server-side
    // anti-cheat (validateSteps) are sufficient protection against stale data.

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

    // Store bonus steps from the server record so the UI shows them immediately
    // (without waiting for the first sync response). This covers the case where
    // admin/system credits bonus steps while the user is logged out.
    if (typeof record.bonusSteps === 'number' && record.bonusSteps > 0) {
      useHealthDataStore.getState().setBonusSteps(record.bonusSteps, today);
    }

    // Step offset calculation (for native sensor real-time updates)
    if (typeof record.steps === 'number' && record.steps > 0) {
      const { stepService } = await import('../../../services/stepService');
      const currentNativeSteps = await stepService.getCurrentSteps();

      // Store the native sensor's step count at login time so the onStepUpdate
      // handler can compute post-login deltas for real-time live updates.
      // This prevents the native sensor's pre-login steps from being double-counted
      // with the server baseline in the additive calculation.
      useHealthDataStore.getState().setNativeStepsAtLogin(currentNativeSteps);

      // ── FIX: Inflation guard ───────────────────────────────────────────────
      // If the server's step count is more than 2x the native sensor's reading,
      // the server likely has inflated data from the previous circular write bug.
      // In that case, don't trust the server steps for offset/floor calculations.
      //
      // IMPORTANT: This guard should NOT fire during a fresh login session.
      // On login, the native service was just (re)started so it has very few
      // steps, while the server legitimately has the full day's accumulated
      // steps from before login. The server being >> native is EXPECTED here.
      // We detect "fresh login" by checking if loginTimestamp is recent (< 5 min ago).
      const loginTs = useHealthDataStore.getState().loginTimestamp;
      const isFreshLogin = loginTs ? (Date.now() - loginTs < 5 * 60_000) : false;

      const isLikelyInflated = !isFreshLogin && currentNativeSteps > 100 && record.steps > currentNativeSteps * 2;
      if (isLikelyInflated) {
        console.warn(
          `[StepOffset] Inflation guard: server=${record.steps}, native=${currentNativeSteps}. ` +
          `Server is ${(record.steps / currentNativeSteps).toFixed(1)}x native — likely inflated. ` +
          `Skipping offset and floor injection.`
        );
        useHealthDataStore.getState().setStepOffsetFetched(true);
        return;
      }

      const offset = Math.max(0, record.steps - currentNativeSteps);

      if (offset > 0) {
        useHealthDataStore.getState().setSyncedStepOffset(offset, today);
        console.log(`[StepOffset] Server: ${record.steps}, native: ${currentNativeSteps}, offset: ${offset} for ${today}`);
      }

      // Push server floor to native service so notification and widget also
      // show at least the server's step count (covers re-login, cross-device,
      // and scenarios where Health Connect data is unavailable).
      await stepService.setServerStepFloor(record.steps);

      // Immediately push server steps to the widget so it doesn't stay at 0
      // while waiting for the 15-min background worker or the first sensor event.
      // First ensure logged-out state is cleared, then push the step count.
      try {
        const { widgetService } = await import('../../../services/widgetService');
        await widgetService.setLoggedOut(false); // ensure widget is in normal mode
        const { useAuthStore } = await import('../../auth/store/authStore');
        const goal = useAuthStore.getState().user?.dailyStepGoal || 10000;
        await widgetService.updateWidget(record.steps, goal);
      } catch { /* non-fatal */ }
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
