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
 * Syncs up to 7 days of health data (from login date to today):
 *
 *  LOGIN DAY
 *    - Steps from loginTimestamp → end of day (or now if today)
 *
 *  SUBSEQUENT DAYS
 *    - Full day: 00:00 → 23:59:59 (or now if today)
 *
 * Each POST includes an explicit `date` field (YYYY-MM-DD) so the backend
 * upserts the correct day's record regardless of when the task fires.
 * Days before account creation are rejected server-side as an extra safety net.
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
  GenderForStride,
} from './healthConnect.service';
import {
  showStepGoalNotification,
  showChallengeNotifications,
} from '../hooks/useSyncHealth';
import { BASE_URL } from '../../../utils/api';
import { getTimezone } from '../../../utils/timezone';
import { useNetworkStore } from '../../../store/networkStore';
import { offlineQueue } from '../../../services/offlineQueue';

const TASK_ID = 'com.athlofit.athlofit.healthsync';

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
        'X-Sync-Source': 'background', // Identifies this as a background sync for server-side stale data guard
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
  weightKg: number,
  gender?: GenderForStride,
): Promise<void> {
  const data = await fetchHealthKitDataForRange(startTime, endTime, weightKg, gender);
  if (data.steps === 0) return;

  const body = {
    ...data,
    date: dateStr,
    goalMet: false, // server recalculates
    timezone: getTimezone(), // FIX #3: include device timezone
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
  gender?: GenderForStride,
): Promise<void> {
  // readStepsDeduped() reads individual records and picks the single
  // highest-count source. This prevents inflation from third-party apps
  // (Sweatcoin, Google Fit, Samsung Health) that also write Steps to
  // Health Connect. aggregate() sums all sources and over-counts.
  const steps = await readStepsDeduped(startTime, endTime).catch(() => 0);
  if (steps === 0) return;

  const derived = deriveFromSteps(steps, weightKg, gender);

  const body = {
    date: dateStr,
    steps,
    calories: derived.calories,
    distance: derived.distanceKm,
    activeMinutes: derived.activeMinutes,
    goalMet: false, // server recalculates
    timezone: getTimezone(), // FIX #3: include device timezone
  };

  const result = await postSync(token, body);

  if (result?.goalCoinsAwarded) {
    await showStepGoalNotification(result.stepGoalCoins ?? 50);
  }
  if (result?.newlyCompleted?.length) {
    await showChallengeNotifications(result.newlyCompleted);
  }
}

// ─── Core sync — last 7 days from login date ─────────────────────────────────

export async function runHealthSync(): Promise<void> {
  const token = await tokenService.getAccessToken();
  if (!token) return;

  const now = new Date();

  // ── Read loginTimestamp from persisted store ──────────────────────────────
  const { useHealthDataStore } = await import('../store/healthDataStore');
  const loginTimestamp = useHealthDataStore.getState().loginTimestamp;

  // Determine the earliest date to sync: login date or 7 days ago, whichever is later.
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 6); // today + 6 previous = 7 days
  sevenDaysAgo.setHours(0, 0, 0, 0);

  // FIX: Always sync from 7 days ago (or account start), regardless of loginTimestamp.
  // loginTimestamp filtering is no longer needed client-side — the server handles
  // the accountCreatedDate guard independently.
  const syncStartDate = sevenDaysAgo;

  // Build the list of days to sync (from syncStartDate to today)
  const daysToSync: { dateStr: string; start: Date; end: Date }[] = [];
  const current = new Date(syncStartDate);
  const todayStr = toISODate(now);

  // Midnight sync guard: if we're within 5 minutes of midnight and the
  // health data store still has stale (yesterday's) data, skip syncing today
  // to prevent yesterday's steps from being written under today's date.
  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
  const lastFetchedAt = useHealthDataStore.getState().lastFetchedAt;
  const isStaleData = lastFetchedAt ? (() => {
    const fetchDate = new Date(lastFetchedAt);
    return fetchDate.getDate() !== now.getDate() ||
           fetchDate.getMonth() !== now.getMonth() ||
           fetchDate.getFullYear() !== now.getFullYear();
  })() : false;
  const skipToday = minutesSinceMidnight < 5 && isStaleData;

  // Fresh-login guard: if the user logged in very recently (< 2 minutes ago)
  // and the health data store hasn't been refreshed for today yet, skip syncing
  // today. This prevents the background sync from pushing stale Health Connect
  // data (which may include yesterday's cached records) before the foreground
  // app has had a chance to do a proper fresh fetch.
  const loginTs = loginTimestamp || 0;
  const msSinceLogin = now.getTime() - loginTs;
  const isFreshLogin = loginTs > 0 && msSinceLogin < 2 * 60 * 1000; // < 2 min
  const skipTodayFreshLogin = isFreshLogin && !lastFetchedAt;

  while (current <= now) {
    const dateStr = toISODate(current);
    const isToday = dateStr === todayStr;

    // Skip today if data hasn't been refreshed yet (midnight reset pending)
    // or if this is a fresh login and foreground hasn't fetched yet
    if (isToday && (skipToday || skipTodayFreshLogin)) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    // Always use startOfDay for all days — no loginTimestamp filtering.
    // This ensures the background sync reports the same step count as
    // the app, notification, and widget.
    const dayStart = startOf(new Date(current));

    // End of the sync window:
    // - Today: use now
    // - Past days: use end of day (23:59:59)
    const dayEnd = isToday ? new Date(now) : endOf(new Date(current));

    daysToSync.push({ dateStr, start: dayStart, end: dayEnd });
    current.setDate(current.getDate() + 1);
  }

  // ── iOS — HealthKit ───────────────────────────────────────────────────────
  if (Platform.OS === 'ios') {
    const ready = await initializeHealthKit();
    if (!ready) return;

    const { useAuthStore } = await import('../../auth/store/authStore');
    const weightKg = useAuthStore.getState().user?.weight ?? 70;
    const gender = useAuthStore.getState().user?.gender;

    for (const day of daysToSync) {
      await syncOneDayIOS(
        day.dateStr,
        day.start.toISOString(),
        day.end.toISOString(),
        token,
        weightKg,
        gender,
      );
    }
    return;
  }

  // ── Android — Health Connect ──────────────────────────────────────────────
  const available = await isHealthConnectAvailable();
  if (!available) return;

  const { initialize } = require('react-native-health-connect');
  const initialized = await initialize();
  if (!initialized) return;

  // Give the Health Connect IPC binding time to settle before reading
  await new Promise<void>(r => setTimeout(r, 300));

  const { useAuthStore } = await import('../../auth/store/authStore');
  const weightKg = useAuthStore.getState().user?.weight ?? 70;
  const gender = useAuthStore.getState().user?.gender;

  for (const day of daysToSync) {
    await syncOneDayAndroid(
      day.dateStr,
      day.start.toISOString(),
      day.end.toISOString(),
      token,
      weightKg,
      gender,
    );
  }
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
