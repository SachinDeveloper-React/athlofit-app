// src/services/crashReporting.ts
//
// Crash and non-fatal error reporting via Firebase Crashlytics.
//
// The app shipped to the Play Store with no crash reporting at all: if the app
// died on a user's phone, nothing anywhere recorded it. That is the same
// blindness that made "has this user installed the fix?" unanswerable, applied
// to a worse failure mode — at least a bad step count is visible in the ledger,
// whereas a crash is invisible unless the user happens to complain.
//
// Every report is tagged with the app build and device, so a spike can be
// attributed to a specific release instead of guessing.

import crashlytics from '@react-native-firebase/crashlytics';
import { getDeviceSnapshot } from '../utils/deviceInfo';

let initialised = false;

/**
 * Attach build/device context to every future report.
 *
 * Call once during app bootstrap. Crashlytics keys are sticky — they are
 * attached to reports raised later, including ones from a native crash the JS
 * layer never sees — so setting them early is what makes a crash report
 * self-describing.
 */
export function initCrashReporting(): void {
  if (initialised) return;
  initialised = true;

  try {
    const d = getDeviceSnapshot();
    crashlytics().setAttributes({
      appVersion: d.appVersion,
      buildNumber: d.buildNumber,
      platform: d.platform,
      osVersion: d.osVersion,
      deviceModel: d.model,
      deviceBrand: d.brand,
      // Same install id the API headers carry, so a crash can be lined up
      // against that device's server-side request history.
      installId: d.installId,
    });

    // Off in development: local crashes while iterating would drown the real
    // signal, and __DEV__ stack traces are already in the Metro console.
    crashlytics().setCrashlyticsCollectionEnabled(!__DEV__);
  } catch {
    // Crash reporting must never be the thing that breaks the app.
  }
}

/**
 * Associate subsequent reports with a user.
 *
 * Deliberately the Mongo id and nothing else — no email, no name, no phone.
 * It is enough to find the account in the admin panel, and it keeps personal
 * data out of a third-party dashboard that the account-deletion purge has no
 * way to reach.
 */
export function setCrashUser(userId: string | null): void {
  try {
    crashlytics().setUserId(userId ?? '');
  } catch {
    /* non-fatal */
  }
}

/**
 * Record a handled error that did not crash the app.
 *
 * Most of what goes wrong in this app is swallowed by a `.catch(() => {})` — a
 * failed sync, a health-platform read that threw, a permission that vanished.
 * Those are invisible today. Routing the ones that matter through here makes
 * them countable without changing behaviour.
 *
 * @param error    the thrown value; non-Error values are wrapped
 * @param context  short label for where it came from, e.g. 'healthSync'
 * @param extra    small key/value details attached to this report only
 */
export function recordError(
  error: unknown,
  context: string,
  extra?: Record<string, string | number | boolean>,
): void {
  try {
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        crashlytics().setAttribute(`${context}_${k}`, String(v));
      }
    }
    const err = error instanceof Error ? error : new Error(String(error));
    // jsErrorName groups the report in the dashboard. Using the context rather
    // than the message keeps every failure of one subsystem in a single issue
    // instead of splitting it across a hundred one-off messages.
    crashlytics().recordError(err, context);
  } catch {
    /* non-fatal */
  }
}

/**
 * Breadcrumb. Shows up in the timeline preceding a crash, which is usually the
 * only way to reconstruct what the user was doing when it happened.
 */
export function logBreadcrumb(message: string): void {
  try {
    crashlytics().log(message);
  } catch {
    /* non-fatal */
  }
}
