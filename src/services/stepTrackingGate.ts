// src/services/stepTrackingGate.ts
//
// Turns the step-tracking flag into actual device behaviour.
//
// Flipping a boolean in a store is not enough: on Android the step count comes
// from a foreground service and two WorkManager workers that keep running — and
// keep POSTing — whether or not any React code is mounted. Disabling has to
// reach down and stop them, and re-enabling has to start them again.
//
// Everything that learns about a state change (the API layer's 403 handler, the
// FCM handler, the profile fetch) calls applyStepTrackingState here rather than
// touching the store directly, so the side effects can never be forgotten at
// one of the call sites.

import { Platform } from 'react-native';
import {
  isVersionBlocked,
  pruneStaleVersionBlock,
  useStepTrackingStore,
} from '../store/stepTrackingStore';
import { stepService } from './stepService';
import { getDeviceSnapshot } from '../utils/deviceInfo';

/** Machine-readable code the backend returns on a blocked step sync. */
export const STEPS_DISABLED_CODE = 'STEPS_TRACKING_DISABLED';

/** Returned when the server has barred this APP BUILD, not this account. */
export const VERSION_BLOCKED_CODE = 'STEPS_VERSION_BLOCKED';

/**
 * Record the server's current answer and bring the native layer in line.
 *
 * @param enabled  what the server says
 * @param reason   admin-written explanation, shown to the user when disabled
 * @returns true when this call changed the state
 */
export async function applyStepTrackingState(
  enabled: boolean,
  reason?: string | null,
): Promise<boolean> {
  const changed = useStepTrackingStore.getState().applyServerState(enabled, reason);

  // Act on every disable, not only on a transition. The native service can be
  // restarted by the OS (BootReceiver, service restart after a kill) while the
  // store still reads "disabled", so a no-change disable is a real opportunity
  // to stop something that came back on its own.
  // Mirror into native SharedPreferences first. The foreground service and the
  // WorkManager jobs read that flag directly and are restarted by the OS with
  // no React context, so the JS store alone cannot hold them off.
  await mirrorToNative(enabled && !isVersionBlocked(), reason);

  if (!enabled) {
    await stopNativeTracking();
  } else if (isVersionBlocked()) {
    // Account is fine but the running build is barred. Without this branch a
    // profile fetch — which only ever reports the ACCOUNT state — would restart
    // the native service on every launch and flap it against the server's 403.
    await stopNativeTracking();
  } else if (changed) {
    // Only on a genuine re-enable — calling start() on every enabled response
    // would re-request the ACTIVITY_RECOGNITION permission dialog repeatedly.
    await startNativeTracking();
  }

  return changed;
}

async function mirrorToNative(enabled: boolean, reason?: string | null): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await stepService.setTrackingEnabled(enabled, reason);
  } catch {
    // Native module unavailable — the JS-side guards still apply.
  }
}

async function stopNativeTracking(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await stepService.stop();
  } catch {
    // Service may already be stopped, or the native module unavailable.
  }
}

async function startNativeTracking(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await stepService.initialize();
  } catch {
    // Permission denied or module unavailable — the user can retry from the
    // Steps screen; failing here must not throw into an FCM or API handler.
  }
}

/**
 * Parse an error body from any API call and apply it if it is the step-tracking
 * rejection. Returns true when it was handled.
 *
 * Matches on `code`, not on the HTTP status or the message: several unrelated
 * conditions return 403, and the message is admin-authored copy that changes.
 */
export function handleStepTrackingError(body: any): boolean {
  if (body?.code === STEPS_DISABLED_CODE) {
    applyStepTrackingState(false, body?.message).catch(() => {});
    return true;
  }
  if (body?.code === VERSION_BLOCKED_CODE) {
    applyVersionBlock(body?.message).catch(() => {});
    return true;
  }
  return false;
}

/**
 * Record that the server has barred the running build from submitting steps,
 * and shut the native producers down.
 *
 * Stored against the running version string, so installing an update clears it
 * on its own — the only remedy the user has, and one they may take while
 * offline.
 */
export async function applyVersionBlock(reason?: string | null): Promise<void> {
  const version = getDeviceSnapshot().appVersion;
  const changed = useStepTrackingStore
    .getState()
    .applyVersionBlock(version, reason);
  // Mirrored as a BUILD block, not as an account pause. Native stores the
  // version string and clears it once BuildConfig no longer matches, so the
  // device recovers on update without needing a server round-trip. Routing it
  // through the account flag would leave it disabled after updating.
  //
  // Called on every occurrence, not only on the transition — the OS restarts
  // the native service on its own, so a repeat 403 is a chance to stop it again.
  if (Platform.OS === 'android') {
    await stepService.setVersionBlocked(reason).catch(() => {});
  }
  await stopNativeTracking();
  if (changed) {
    console.warn(`[StepTracking] Build ${version} barred from step sync: ${reason ?? ''}`);
  }
}

/**
 * Apply the flag carried on a freshly fetched user profile.
 *
 * The profile is the authoritative read — it corrects the device after any
 * window where a push was missed (notifications off, app killed, no network)
 * and is the only signal that reliably reports a RE-enable, since the 403 path
 * by definition only ever fires while disabled.
 *
 * A server build that predates the field sends nothing; that is treated as
 * enabled, matching the schema default, rather than switching everyone off.
 */
export function applyStepTrackingFromUser(user: any): void {
  const tracking = user?.stepsTracking;
  const enabled = tracking?.enabled !== false;
  applyStepTrackingState(enabled, tracking?.reason).catch(() => {});
}

/**
 * Handle an FCM data payload that may carry a step-tracking change.
 *
 * The backend sends `type: 'STEPS_TRACKING_CHANGED'` with
 * `stepsTrackingEnabled: 'true' | 'false'` (FCM data values are always
 * strings). Wired into both the foreground and the background message
 * handlers, so the device reacts within seconds instead of waiting for the
 * user to next open the app.
 *
 * @returns true when the message was a step-tracking change
 */
export function handleStepTrackingPush(
  data?: Record<string, any> | null,
): boolean {
  if (data?.type !== 'STEPS_TRACKING_CHANGED') return false;
  // Compared as a string: FCM coerces every data value, so `false` arrives as
  // the truthy string "false".
  const enabled = String(data.stepsTrackingEnabled) === 'true';
  applyStepTrackingState(enabled, data.reason).catch(() => {});
  return true;
}

/**
 * Reconcile the JS store with the native flag at launch.
 *
 * The two are written independently: a 403 that lands inside a WorkManager job
 * while the app is closed sets only the native flag, and clearing app storage
 * resets only the JS one. On launch, "disabled" from either side wins — the
 * conservative direction, since the alternative is counting steps the server
 * will reject and coins the user will not keep.
 *
 * This does NOT re-enable. Only the server may do that, via the profile fetch
 * or a push, so a stale native flag cannot resurrect tracking on its own.
 */
export async function reconcileNativeStepTracking(): Promise<void> {
  // Clear a block belonging to a build that is no longer installed. Done here
  // — inside an effect-driven service call — rather than in the predicate,
  // which is read during render and must not write to the store.
  pruneStaleVersionBlock();

  if (Platform.OS !== 'android') return;
  try {
    const native = await stepService.getNativeTrackingState();
    if (native && native.enabled === false) {
      await applyStepTrackingState(false, native.reason || null);
    }
  } catch {
    // Native module unavailable — the JS store stands on its own.
  }
}
