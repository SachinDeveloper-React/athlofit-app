// src/utils/deviceInfo.ts
//
// One snapshot of "what is this app, on what device", attached as headers to
// every authenticated API call (see api.ts) so the backend can answer the
// question that used to be unanswerable: which build produced this data?
//
// A Play Store rollout is gradual and users update whenever they feel like it,
// so shipping a fix tells you nothing about any individual device. Without a
// version on the wire, a report like "this user is still getting 5,000-step
// jumps" cannot be triaged — there is no way to tell a real regression from a
// device that simply has not taken the update.

import { Platform } from 'react-native';
import {
  getBrand,
  getBuildNumber,
  getManufacturerSync,
  getModel,
  getSystemVersion,
  getUniqueIdSync,
  getVersion,
} from 'react-native-device-info';

export interface DeviceSnapshot {
  appVersion: string;   // "1.72"  — versionName / CFBundleShortVersionString
  buildNumber: string;  // "72"    — versionCode / CFBundleVersion
  platform: 'android' | 'ios';
  osVersion: string;    // "14" / "17.5"
  model: string;        // "Pixel 7"
  brand: string;        // "Google"
  installId: string;    // stable per-install id
}

let cached: DeviceSnapshot | null = null;

/**
 * Resolved once per app launch and memoised. None of these values can change
 * while the process is alive — an app update restarts the process — so
 * recomputing per request would only add native bridge calls to every fetch.
 */
export function getDeviceSnapshot(): DeviceSnapshot {
  if (cached) return cached;

  // Every field is individually guarded. Device-info reads can throw on
  // unusual OEM builds, and telemetry must never be able to break an API call
  // — a missing field is a gap in a dashboard, a thrown error is a dead app.
  const safe = (fn: () => string, fallback = ''): string => {
    try {
      return fn() || fallback;
    } catch {
      return fallback;
    }
  };

  cached = {
    appVersion: safe(getVersion),
    buildNumber: safe(getBuildNumber),
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    osVersion: safe(getSystemVersion),
    model: safe(getModel),
    // getBrand is the marketing name ("google"); manufacturer is the OEM.
    // Prefer manufacturer, fall back to brand — on iOS manufacturer is "unknown".
    brand: safe(getManufacturerSync) || safe(getBrand),
    installId: safe(getUniqueIdSync),
  };

  return cached;
}

/**
 * The X-App-* headers the backend's deviceContext middleware reads.
 *
 * `source` distinguishes the JS layer from the native Android callers that send
 * the same headers by hand (the foreground step service and the WorkManager
 * workers), so a bad sync can be traced to the exact code path that sent it.
 */
export function getDeviceHeaders(
  source: 'app' | 'native_service' | 'worker' = 'app',
): Record<string, string> {
  const d = getDeviceSnapshot();
  return {
    'X-App-Version': d.appVersion,
    'X-App-Build': d.buildNumber,
    'X-Platform': d.platform,
    'X-OS-Version': d.osVersion,
    'X-Device-Model': d.model,
    'X-Device-Brand': d.brand,
    'X-Install-Id': d.installId,
    'X-Client-Source': source,
  };
}
