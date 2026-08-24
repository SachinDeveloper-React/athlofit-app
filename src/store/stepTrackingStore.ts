// src/store/stepTrackingStore.ts
//
// Mirrors the server-side per-user step-tracking kill switch
// (User.stepsTracking on the backend) and enforces it on the device.
//
// Three independent signals can flip this, because no single one is reliable
// on its own:
//   1. GET /user/profile on launch / foreground  — the authoritative read.
//   2. A 403 STEPS_TRACKING_DISABLED from any API call — catches a switch
//      thrown mid-session, without waiting for the next profile fetch.
//   3. An FCM data message of type STEPS_TRACKING_CHANGED — makes it near
//      immediate instead of waiting for the app to be opened.
//
// The value is persisted, so a device that is switched off and then goes
// offline stays off across restarts rather than resuming on a stale default.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from './index';
import { getDeviceSnapshot } from '../utils/deviceInfo';

export const DEFAULT_DISABLED_REASON =
  'Step tracking has been paused on your account. Please contact support.';

export const DEFAULT_VERSION_BLOCK_REASON =
  'Step tracking is paused on this version of the app. Please update to continue earning.';

interface StepTrackingState {
  /** False only when the server has explicitly disabled tracking for this ACCOUNT. */
  enabled: boolean;
  /** Admin-written, user-facing explanation. Null while enabled. */
  reason: string | null;
  /** When the client last heard from the server about this. */
  lastCheckedAt: number | null;

  /**
   * The app version the server barred from submitting steps, or null.
   *
   * Stored as the version STRING rather than a boolean, and that is the whole
   * trick: the block clears by itself the moment the user updates, because the
   * stored version no longer matches the running one. A boolean would have to
   * be cleared by something, and nothing on the device knows when the fix
   * shipped.
   *
   * Kept separate from `enabled` because the two have different remedies and
   * different lifetimes. An account block is lifted by an admin and reported by
   * the profile fetch; a build block is lifted by updating the app, and the
   * profile fetch says nothing about it — folding them together would make
   * every profile fetch clear the build block and re-enable a bad build.
   */
  blockedVersion: string | null;
  /** Why the build was blocked — shown to the user, tells them to update. */
  blockedVersionReason: string | null;

  /**
   * Apply a server-reported ACCOUNT state. Returns true when it actually
   * changed, so the caller can start/stop the native service only on a real
   * transition.
   */
  applyServerState: (enabled: boolean, reason?: string | null) => boolean;
  /** Record that the running build is barred from submitting steps. */
  applyVersionBlock: (appVersion: string, reason?: string | null) => boolean;
  /** Clear a stale build block — called when the running version no longer matches. */
  clearVersionBlock: () => void;
  reset: () => void;
}

export const useStepTrackingStore = create<StepTrackingState>()(
  persist(
    (set, get) => ({
      // Enabled by default: a user who has never been touched must track
      // normally, and a fresh install with no server answer yet must not be
      // silently broken.
      enabled: true,
      reason: null,
      lastCheckedAt: null,
      blockedVersion: null,
      blockedVersionReason: null,

      applyVersionBlock: (appVersion, reason) => {
        const changed = get().blockedVersion !== appVersion;
        set({
          blockedVersion: appVersion,
          blockedVersionReason: reason || DEFAULT_VERSION_BLOCK_REASON,
          lastCheckedAt: Date.now(),
        });
        return changed;
      },

      clearVersionBlock: () =>
        set({ blockedVersion: null, blockedVersionReason: null }),

      applyServerState: (enabled, reason) => {
        const changed = get().enabled !== enabled;
        set({
          enabled,
          reason: enabled ? null : reason || DEFAULT_DISABLED_REASON,
          lastCheckedAt: Date.now(),
        });
        return changed;
      },

      // Called on logout — the flag belongs to an account, not to the device,
      // so it must not leak into whoever signs in next.
      reset: () =>
        set({
          enabled: true,
          reason: null,
          lastCheckedAt: null,
          // The build block is NOT cleared on logout: it is a property of the
          // installed APK, not of whoever is signed in. Clearing it would let
          // a bad build resume submitting simply by signing out and back in.
          blockedVersion: get().blockedVersion,
          blockedVersionReason: get().blockedVersionReason,
        }),
    }),
    {
      name: 'step-tracking-state',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (s) => ({
        enabled: s.enabled,
        reason: s.reason,
        lastCheckedAt: s.lastCheckedAt,
        blockedVersion: s.blockedVersion,
        blockedVersionReason: s.blockedVersionReason,
      }),
    },
  ),
);

/**
 * Whether the running build is currently barred from submitting steps.
 *
 * Compares the STORED blocked version against the version actually running, so
 * an update silently clears the block with no server round-trip — which matters
 * because the update is the only remedy and the user may be offline right after
 * installing it.
 */
export const isVersionBlocked = (): boolean => {
  const blocked = useStepTrackingStore.getState().blockedVersion;
  if (!blocked) return false;
  return blocked === getDeviceSnapshot().appVersion;
};

/**
 * Drop a block left behind by a build that is no longer installed.
 *
 * Housekeeping only — isVersionBlocked() already answers correctly with the
 * stale value present, because it compares against the running version rather
 * than trusting the flag. Kept as a separate call precisely so the predicate
 * stays pure: it is read during render by the warning banner, and a store write
 * from inside a render is a React rule violation that can re-render the very
 * component subscribed to that store.
 *
 * Safe to call from anywhere that is not a render — an effect, a service, app
 * bootstrap.
 */
export const pruneStaleVersionBlock = (): void => {
  const { blockedVersion, clearVersionBlock } = useStepTrackingStore.getState();
  if (blockedVersion && blockedVersion !== getDeviceSnapshot().appVersion) {
    clearVersionBlock();
  }
};

/**
 * The single question every caller should ask: may this device count and
 * submit steps right now?
 *
 * Both gates in one place so no call site can check the account switch and
 * forget the build gate.
 */
export const isStepTrackingEnabled = (): boolean =>
  useStepTrackingStore.getState().enabled && !isVersionBlocked();
