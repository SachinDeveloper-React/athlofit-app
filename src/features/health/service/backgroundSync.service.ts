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
import { getDeviceHeaders } from '../../../utils/deviceInfo';
import { isStepTrackingEnabled } from '../../../store/stepTrackingStore';
import { handleStepTrackingError } from '../../../services/stepTrackingGate';
import { recordError } from '../../../services/crashReporting';
import {
  fetchHealthKitDataForRange,
  initializeHealthKit,
} from './healthkit.service';
import {
  isHealthConnectAvailable,
  deriveFromSteps,
  readTodayStepsDetailed,
  GenderForStride,
} from './healthConnect.service';
import {
  MAX_PLAUSIBLE_DAILY_STEPS,
  MAX_STEPS_PER_MINUTE,
  minutesSinceLocalMidnight,
} from './stepEngine';
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
        // This path uses raw fetch rather than the api client, so it has to
        // carry the build/device headers itself — without them the syncs that
        // run while the app is closed would be the ones with no version on
        // them, which is exactly the data hardest to explain after the fact.
        ...getDeviceHeaders('worker'),
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      // 403 STEPS_TRACKING_DISABLED — an admin paused this account's steps.
      // Handled here too because a background sync may be the first caller to
      // learn of it, and it must stop the native service rather than quietly
      // retrying every fifteen minutes forever.
      if (response.status === 403) {
        const body403 = await response.json().catch(() => null);
        handleStepTrackingError(body403);
      }
      return null;
    }
    const json = await response.json();
    return json?.data ?? null;
  } catch (e) {
    console.warn('[BackgroundSync] postSync error:', e);
    // This path runs with the app closed, so a console warning reaches nobody.
    // Background sync silently failing for days is exactly the class of problem
    // that took weeks to notice before.
    recordError(e, 'backgroundSyncPost', { date: String((body as any)?.date ?? '') });
    return null;
  }
}

// ─── Plausibility ─────────────────────────────────────────────────────────────

/**
 * Rejects a step count that cannot belong to the day it claims to.
 *
 * Health Connect and HealthKit can both return yesterday's cached or batched records
 * under a today range. The obvious case is just after midnight, and that is all the
 * previous guard covered — it only ran in the first five minutes, so a device that
 * surfaces a stale full-day total at 06:00 sailed straight through.
 *
 * Uses the same constants as the step engine so the background path cannot accept a
 * figure the foreground pipeline would reject.
 */
function isPlausibleForDay(dateStr: string, steps: number): boolean {
  if (steps > MAX_PLAUSIBLE_DAILY_STEPS) {
    console.warn(
      `[BackgroundSync] Skipping ${dateStr}: ${steps} exceeds the daily limit of ` +
      `${MAX_PLAUSIBLE_DAILY_STEPS}`,
    );
    return false;
  }

  // Only today can be bounded by elapsed time; past days are complete by definition.
  if (dateStr !== toISODate(new Date())) return true;

  const minutes = minutesSinceLocalMidnight();
  const bound = Math.min(MAX_PLAUSIBLE_DAILY_STEPS, minutes * MAX_STEPS_PER_MINUTE);
  if (steps > bound) {
    console.warn(
      `[BackgroundSync] Skipping today: ${steps} steps ${minutes}min into the day ` +
      `exceeds the ${MAX_STEPS_PER_MINUTE} steps/min bound (${bound})`,
    );
    return false;
  }
  return true;
}

// ─── Shared post step ─────────────────────────────────────────────────────────

/**
 * POSTs one day's payload and handles the follow-up both platforms need.
 *
 * ## Why recording the pushed value matters
 *
 * The step engine treats a server value as an "echo" — carrying no information this
 * device does not already have — when it is no higher than what this device last
 * pushed today. Only the foreground sync used to record that, so anything this
 * background path pushed was invisible to it: the engine would later read the same
 * number back from the server, conclude another device must have contributed it, and
 * trust it as a floor. Recording it here closes that blind spot.
 */
async function postDayAndRecord(
  token: string,
  dateStr: string,
  steps: number,
  body: Record<string, unknown>,
): Promise<void> {
  const result = await postSync(token, body);
  if (!result) return;

  const todayStr = toISODate(new Date());
  if (dateStr === todayStr) {
    const { useHealthDataStore } = await import('../store/healthDataStore');
    const { lastPushedSteps, lastPushedStepsDate } = useHealthDataStore.getState();
    // Only ever raise it. The foreground figure is the more complete one — it
    // resolves across the native sensor too — so a lower background value from the
    // same day must not mask it.
    if (lastPushedStepsDate !== todayStr || steps > lastPushedSteps) {
      useHealthDataStore.getState().setLastPushedSteps(steps, todayStr);
    }
  }

  if (result.goalCoinsAwarded) {
    await showStepGoalNotification(result.stepGoalCoins ?? 50);
  }
  if (result.newlyCompleted?.length) {
    await showChallengeNotifications(result.newlyCompleted);
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
  if (data.steps <= 0) return;

  // Plausibility guard, using the engine's constants and applying all day rather
  // than only in the first five minutes after midnight — a device that batches its
  // records can surface a stale full-day total at 06:00 just as easily.
  if (!isPlausibleForDay(dateStr, data.steps)) return;

  const body = {
    ...data,
    date: dateStr,
    // `goalMet` is deliberately omitted so the server decides. It used to be sent
    // as a literal `false` under the comment "server recalculates", which it did
    // not: the server read it with `??`, and `false ?? x` is `false`. A user who
    // only ever syncs in the background therefore never had the goal recorded as
    // met, never received the daily step-goal coins, and never advanced a streak.
    timezone: getTimezone(), // FIX #3: include device timezone
  };

  await postDayAndRecord(token, dateStr, data.steps, body);
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
  // Same reader the foreground pipeline uses, so this path and the app can never
  // disagree about what Health Connect says for a given day. Its result is bounded
  // to [largest origin, sum of origins], which is what makes it safe to POST.
  const read = await readTodayStepsDetailed(startTime, endTime).catch(() => null);
  // A failed read is not "zero steps" — posting 0 would be a lie the server has no
  // way to distinguish from a genuinely inactive day.
  if (!read || !read.available || read.steps <= 0) return;
  const steps = read.steps;

  if (!isPlausibleForDay(dateStr, steps)) return;

  const derived = deriveFromSteps(steps, weightKg, gender);

  const body = {
    date: dateStr,
    steps,
    calories: derived.calories,
    distance: derived.distanceKm,
    activeMinutes: derived.activeMinutes,
    // `goalMet` is deliberately omitted so the server decides. It used to be sent
    // as a literal `false` under the comment "server recalculates", which it did
    // not: the server read it with `??`, and `false ?? x` is `false`. A user who
    // only ever syncs in the background therefore never had the goal recorded as
    // met, never received the daily step-goal coins, and never advanced a streak.
    timezone: getTimezone(), // FIX #3: include device timezone
    // ── Where these steps came from ─────────────────────────────────────────
    // This path matters more than the foreground one for attribution: it is the
    // path that flushes a backlog after the phone has been offline, which is the
    // exact case a large jump needs explaining for. The reader is named directly
    // rather than taken from a step resolution, because there is no resolution
    // here — Health Connect IS the source on this path, unconditionally.
    stepSource: {
      reader: 'health_connect' as const,
      method: read.method,
      primaryOrigin: read.primaryOrigin || undefined,
      origins: read.origins.map(o => ({
        packageName: o.packageName,
        steps: o.steps,
        contributed:
          o.packageName === read.primaryOrigin
            ? o.steps
            : read.contributions.find(c => c.packageName === o.packageName)?.contributed ?? 0,
        disjointFraction:
          o.packageName === read.primaryOrigin
            ? 1
            : read.contributions.find(c => c.packageName === o.packageName)?.disjointFraction ?? 0,
      })),
      hourly: read.hourly?.length ? read.hourly : undefined,
      recordedFrom: read.recordedFrom ?? undefined,
      recordedTo: read.recordedTo ?? undefined,
      recordCount: read.recordCount,
    },
  };

  await postDayAndRecord(token, dateStr, steps, body);
}

// ─── Core sync — last 7 days from account creation ───────────────────────────

export async function runHealthSync(): Promise<void> {
  const token = await tokenService.getAccessToken();
  if (!token) return;

  // Step tracking paused for this account by an admin — every day this
  // function would post carries steps, so there is nothing here to do.
  // Hydration and other non-step writes go through their own paths.
  if (!isStepTrackingEnabled()) {
    console.log('[BackgroundSync] Skipped — step tracking disabled for this account');
    return;
  }

  const now = new Date();

  // ── Read user's account creation date from auth store ────────────────────
  const { useAuthStore } = await import('../../auth/store/authStore');
  const accountCreatedAt = useAuthStore.getState().user?.createdAt;
  
  // Determine the earliest date to sync: account creation date or 7 days ago,
  // whichever is LATER (more recent).
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 6); // today + 6 previous = 7 days
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const accountCreationDate = accountCreatedAt 
    ? new Date(new Date(accountCreatedAt).toISOString().slice(0, 10))
    : sevenDaysAgo;
  
  // Use the more recent date (closer to today) as the start point
  const syncStartDate = accountCreationDate > sevenDaysAgo ? accountCreationDate : sevenDaysAgo;

  // Build the list of days to sync (from syncStartDate to today)
  const daysToSync: { dateStr: string; start: Date; end: Date }[] = [];
  const current = new Date(syncStartDate);
  const todayStr = toISODate(now);

  // Midnight sync guard: if we're within 5 minutes of midnight and the
  // health data store still has stale (yesterday's) data, skip syncing today
  // to prevent yesterday's steps from being written under today's date.
  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
  const { useHealthDataStore } = await import('../store/healthDataStore');
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
  const loginTimestamp = useHealthDataStore.getState().loginTimestamp;
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

  console.log(`[BackgroundSync] Syncing ${daysToSync.length} days from ${syncStartDate.toISOString().slice(0, 10)} to today`);

  // ── iOS — HealthKit ───────────────────────────────────────────────────────
  if (Platform.OS === 'ios') {
    const ready = await initializeHealthKit();
    if (!ready) return;

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
  
  console.log(`[BackgroundSync] Completed syncing ${daysToSync.length} days`);
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
