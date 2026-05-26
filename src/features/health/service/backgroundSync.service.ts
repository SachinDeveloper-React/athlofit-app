/**
 * backgroundSync.service.ts
 *
 * Periodic background health sync using react-native-background-fetch.
 * Handles iOS (HealthKit) and acts as a JS-layer fallback on Android.
 *
 * On Android the primary sync path is the native WidgetUpdateWorker
 * (WorkManager, every 15 min) + EodSyncWorker (exact alarm at 23:59:50).
 * This JS layer runs as a secondary fallback via react-native-background-fetch.
 *
 * Syncs TWO records per run:
 *
 *  TODAY
 *    - First login day : steps from loginTimestamp → now
 *    - Subsequent days : steps from 00:00 → now  (loginTimestamp < midnight)
 *
 *  YESTERDAY
 *    - Always full day : 00:00 → 23:59:59  (no login filter)
 *
 * Each POST includes an explicit `date` field (YYYY-MM-DD) so the backend
 * upserts the correct day's record regardless of when the task fires.
 */

import BackgroundFetch from 'react-native-background-fetch';
import { Platform } from 'react-native';
import { tokenService } from '../../auth/service/tokenService';
import {
  fetchHealthKitDataForRange,
  initializeHealthKit,
} from './healthkit.service';
import {
  isHealthConnectAvailable,
  deriveFromSteps,
  readStepsDeduped,
} from './healthConnect.service';
import { initialize } from 'react-native-health-connect';
import {
  showStepGoalNotification,
  showChallengeNotifications,
} from '../hooks/useSyncHealth';
import { BASE_URL } from '../../../utils/api';
import { useNetworkStore } from '../../../store/networkStore';
import { offlineQueue } from '../../../services/offlineQueue';

const TASK_ID = 'com.athlofit.healthsync';

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** YYYY-MM-DD for a given Date (local time) */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Start of a given date at 00:00:00.000 local time */
function startOf(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

/** End of a given date at 23:59:59.999 local time */
function endOf(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

// ─── POST helper ──────────────────────────────────────────────────────────────

async function postSync(token: string, body: object): Promise<any> {
  // If offline, enqueue the payload for later sync instead of calling the server
  const { isOnline } = useNetworkStore.getState();
  if (!isOnline) {
    offlineQueue.enqueue({
      endpoint: 'health/sync',
      method: 'POST',
      payload: body as Record<string, unknown>,
      timestamp: new Date().toISOString(),
      actionType: 'health_sync',
    });
    return null;
  }

  try {
    const response = await fetch(`${BASE_URL}health/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    const json = await response.json();
    return json?.data ?? null;
  } catch (e) {
    console.warn('[BackgroundSync] postSync error:', e);
    return null;
  }
}

// ─── iOS single-day sync ──────────────────────────────────────────────────────

/**
 * Fetch HealthKit data for [startTime, endTime] and POST to /health/sync.
 * The `dateStr` is the YYYY-MM-DD label sent to the backend for upsert.
 */
async function syncOneDayIOS(
  dateStr: string,
  startTime: string,
  endTime: string,
  token: string,
): Promise<void> {
  const data = await fetchHealthKitDataForRange(startTime, endTime);
  if (data.steps === 0) return;

  const body = {
    ...data,
    date: dateStr,
    goalMet: false, // server recalculates
  };

  const result = await postSync(token, body);

  if (result?.goalCoinsAwarded) {
    await showStepGoalNotification(result.stepGoalCoins ?? 50);
  }
  if (result?.newlyCompleted?.length) {
    await showChallengeNotifications(result.newlyCompleted);
  }
}

// ─── Android single-day sync ──────────────────────────────────────────────────

/**
 * Read steps from Health Connect for [startTime, endTime], derive other
 * metrics, and POST to /health/sync.
 */
async function syncOneDayAndroid(
  dateStr: string,
  startTime: string,
  endTime: string,
  token: string,
  weightKg: number,
): Promise<void> {
  // readStepsDeduped() reads individual records and picks the single
  // highest-count source. This prevents inflation from third-party apps
  // (Sweatcoin, Google Fit, Samsung Health) that also write Steps to
  // Health Connect. aggregate() sums all sources and over-counts.
  const steps = await readStepsDeduped(startTime, endTime).catch(() => 0);
  if (steps === 0) return;

  const derived = deriveFromSteps(steps, weightKg);

  const body = {
    date: dateStr,
    steps,
    calories: derived.calories,
    distance: derived.distanceKm,
    activeMinutes: derived.activeMinutes,
    goalMet: false, // server recalculates
  };

  const result = await postSync(token, body);

  if (result?.goalCoinsAwarded) {
    await showStepGoalNotification(result.stepGoalCoins ?? 50);
  }
  if (result?.newlyCompleted?.length) {
    await showChallengeNotifications(result.newlyCompleted);
  }
}

// ─── Core sync — today + yesterday ───────────────────────────────────────────

export async function runHealthSync(): Promise<void> {
  const token = await tokenService.getAccessToken();
  if (!token) return;

  const now       = new Date();
  const today     = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const todayStr     = toISODate(today);
  const yesterdayStr = toISODate(yesterday);

  // ── Read loginTimestamp from persisted store ──────────────────────────────
  // Dynamic import avoids circular deps and works in headless context.
  const { useHealthDataStore } = await import('../store/healthDataStore');
  const loginTimestamp = useHealthDataStore.getState().loginTimestamp;

  // Effective start for today's step window:
  //   - If loginTimestamp is within today (after midnight), use it.
  //   - Otherwise (subsequent days or no timestamp), use midnight.
  const todayMidnight = startOf(today);
  const effectiveTodayStart =
    loginTimestamp && loginTimestamp > todayMidnight.getTime()
      ? new Date(loginTimestamp)
      : todayMidnight;

  // ── iOS — HealthKit ───────────────────────────────────────────────────────
  if (Platform.OS === 'ios') {
    const ready = await initializeHealthKit();
    if (!ready) return;

    // TODAY: from effectiveTodayStart → now
    await syncOneDayIOS(
      todayStr,
      effectiveTodayStart.toISOString(),
      now.toISOString(),
      token,
    );

    // YESTERDAY: full day 00:00 → 23:59:59 (no login filter)
    await syncOneDayIOS(
      yesterdayStr,
      startOf(yesterday).toISOString(),
      endOf(yesterday).toISOString(),
      token,
    );

    return;
  }

  // ── Android — Health Connect ──────────────────────────────────────────────
  const available = await isHealthConnectAvailable();
  if (!available) return;

  const initialized = await initialize();
  if (!initialized) return;

  // Give the Health Connect IPC binding time to settle before reading
  await new Promise<void>(r => setTimeout(r, 300));

  const { useAuthStore } = await import('../../auth/store/authStore');
  const weightKg = useAuthStore.getState().user?.weight ?? 70;

  // TODAY: from effectiveTodayStart → now
  await syncOneDayAndroid(
    todayStr,
    effectiveTodayStart.toISOString(),
    now.toISOString(),
    token,
    weightKg,
  );

  // YESTERDAY: full day 00:00 → 23:59:59 (no login filter)
  await syncOneDayAndroid(
    yesterdayStr,
    startOf(yesterday).toISOString(),
    endOf(yesterday).toISOString(),
    token,
    weightKg,
  );
}

// ─── Register periodic background fetch ──────────────────────────────────────

export async function registerBackgroundSync(): Promise<void> {
  try {
    const status = await BackgroundFetch.configure(
      {
        minimumFetchInterval: 15,       // minutes (OS minimum)
        stopOnTerminate: false,          // keep running after app is killed
        startOnBoot: true,               // reschedule after device reboot
        enableHeadless: true,            // Android headless task support
        requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
        requiresCharging: false,
        requiresDeviceIdle: false,
        requiresBatteryNotLow: false,
        requiresStorageNotLow: false,
      },
      async (taskId) => {
        try {
          await runHealthSync();
        } catch (e) {
          console.warn('[BackgroundSync] task error:', e);
        } finally {
          BackgroundFetch.finish(taskId);
        }
      },
      (taskId) => {
        console.warn('[BackgroundSync] timeout:', taskId);
        BackgroundFetch.finish(taskId);
      },
    );
    console.log('[BackgroundSync] registered, status:', status);
  } catch (e) {
    console.warn('[BackgroundSync] configure failed:', e);
  }
}

// ─── Android headless task ────────────────────────────────────────────────────
// Runs when the app is fully terminated (killed from recents).
// Registered in index.js via BackgroundFetch.registerHeadlessTask().

export async function headlessTask(event: { taskId: string }): Promise<void> {
  try {
    await runHealthSync();
  } catch (e) {
    console.warn('[BackgroundSync] headless error:', e);
  } finally {
    BackgroundFetch.finish(event.taskId);
  }
}

// ─── Stop (call on logout) ────────────────────────────────────────────────────

export async function stopBackgroundSync(): Promise<void> {
  try {
    await BackgroundFetch.stop(TASK_ID);
  } catch {
    // ignore — task may not have been registered yet
  }
}
