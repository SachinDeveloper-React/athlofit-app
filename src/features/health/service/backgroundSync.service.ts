/**
 * backgroundSync.service.ts
 *
 * Periodic background health sync using react-native-background-fetch.
 * Runs every ~15 minutes even when the app is closed or in recents.
 *
 * NOTE: On Android the real periodic background sync is done natively by
 * WidgetUpdateWorker (WorkManager, every 15 min) which reads Health Connect
 * and POSTs to /health/sync without needing JS at all.
 *
 * This JS layer handles iOS (HealthKit) and acts as a fallback on Android
 * when the native worker hasn't fired yet.
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
  isHealthConnectAvailable,
} from './healthConnect.service';
import { initialize } from 'react-native-health-connect';
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
    // iOS: initialize HealthKit (no permission dialog in background)
    const ready = await initializeHealthKit();
    if (!ready) return;
    healthData = await fetchAllHealthKitData();
  } else {
    // Android: only call initialize() — never requestPermission() in background.
    // Permissions were already granted when the user was in the foreground.
    // Calling requestPermission() in a headless context throws or hangs.
    const available = await isHealthConnectAvailable();
    if (!available) return;
    const initialized = await initialize();
    if (!initialized) return;
    // Small settle delay (same as initializeHealthConnect)
    await new Promise<void>(r => setTimeout(r, 300));

    // Pass the persisted loginTimestamp so steps are filtered from login time,
    // not from midnight — prevents syncing the full day's steps on first login.
    const { useHealthDataStore } = await import('../store/healthDataStore');
    const loginTimestamp = useHealthDataStore.getState().loginTimestamp;
    healthData = await fetchAllHealthConnectData(undefined, loginTimestamp);
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
