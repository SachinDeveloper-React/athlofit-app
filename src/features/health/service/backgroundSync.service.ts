/**
 * backgroundSync.service.ts
 *
 * Periodic background health sync using react-native-background-fetch.
 * Runs every ~15 minutes even when the app is closed or in recents.
 *
 * The guaranteed end-of-day sync at 23:59:50 is handled natively by
 * EodSyncScheduler + EodSyncWorker (Android) — no JS layer needed.
 */

import BackgroundFetch from 'react-native-background-fetch';
import { Platform } from 'react-native';
import { tokenService } from '../../auth/service/tokenService';
import {
  fetchAllHealthKitData,
  initializeHealthKit,
} from './healthkit.service';
import {
  fetchAllHealthConnectData,
  initializeHealthConnect,
  isHealthConnectAvailable,
} from './healthConnect.service';
import {
  showStepGoalNotification,
  showChallengeNotifications,
} from '../hooks/useSyncHealth';
import { BASE_URL } from '../../../utils/api';

const TASK_ID = 'com.athlofit.healthsync';

// ─── Core sync logic ──────────────────────────────────────────────────────────

export async function runHealthSync(): Promise<void> {
  const token = await tokenService.getAccessToken();
  if (!token) return;

  let healthData;

  if (Platform.OS === 'ios') {
    const ready = await initializeHealthKit();
    if (!ready) return;
    healthData = await fetchAllHealthKitData();
  } else {
    const available = await isHealthConnectAvailable();
    if (!available) return;
    const ready = await initializeHealthConnect();
    if (!ready) return;
    healthData = await fetchAllHealthConnectData();
  }

  if (!healthData || healthData.steps === 0) return;

  const response = await fetch(`${BASE_URL}health/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...healthData, goalMet: false }),
  });

  if (!response.ok) return;

  const json = await response.json();
  const d = json?.data;

  if (d?.goalCoinsAwarded) {
    await showStepGoalNotification(d.stepGoalCoins ?? 50);
  }
  if (d?.newlyCompleted?.length) {
    await showChallengeNotifications(d.newlyCompleted);
  }
}

// ─── Register periodic background fetch ──────────────────────────────────────

export async function registerBackgroundSync(): Promise<void> {
  try {
    const status = await BackgroundFetch.configure(
      {
        minimumFetchInterval: 15,
        stopOnTerminate: false,
        startOnBoot: true,
        enableHeadless: true,
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
    // ignore
  }
}
