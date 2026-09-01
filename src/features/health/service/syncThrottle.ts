// src/features/health/service/syncThrottle.ts
//
// How often the foreground app is allowed to POST /health/sync.
//
// ── Why this is its own module ──────────────────────────────────────────────
//
// The rule used to live as two `const`s inside TrackerScreen's render body, and
// the property test that documents it (preservation.property.test.ts, "2.3
// syncHealth throttle") re-declared its own copies of both numbers rather than
// importing them. So the test asserted a five-minute floor while the screen had
// been changed to twenty seconds, and it passed the whole time: it was testing
// its own literals, not the app.
//
// Extracting the decision here gives both the screen and the test one definition
// to share, so the invariant cannot drift out from under its own test again.
//
// ── What was wrong with the rule itself ─────────────────────────────────────
//
// The skip condition was
//
//     if (notFirstSync && timeSinceLastSync < INTERVAL && stepDelta < DELTA) return;
//
// which skips only when BOTH are true — so a step change of 10 or more bypassed
// the interval completely. Ten steps is about five seconds of walking, and the
// step pipeline republishes every few seconds, so for anyone actually moving the
// condition was permanently satisfied and the app synced on essentially every
// update.
//
// One account shows what that looks like from the server: six posts in seventy
// seconds (20:51:02, :04, :32, :52, 20:52:02, :12), five from the app and one
// from the native service. Every one of them was clamped by the backend's rate
// ceiling — which measures from the last ACCEPTED increase, so each sync in the
// burst was judged against a window of seconds and allowed 7, then 104, then 74,
// then 37, then 37 steps.
//
// It did not slow the count down in aggregate (220 steps/min is 220 steps/min
// however it is sliced), but it turned one clamped sync into five, each with its
// own flag and its own SyncLog row, and it spent battery and radio doing it.
//
// The interval is now a real floor: both conditions must hold to sync, not
// either. Nothing about the displayed step count depends on this — the screen
// renders the local step engine's figure, not the server's — so a longer floor
// costs responsiveness only for coins, streaks and challenge progress, all of
// which the 15-minute native service sync also drives.

/** Minimum wall-clock gap between two foreground syncs. */
export const MIN_SYNC_INTERVAL_MS = 5 * 60_000;

/** Step movement below which a sync has nothing new to report. */
export const MIN_STEP_DELTA = 10;

/** The first sync of a session is identified by this sentinel step count. */
export const NO_PREVIOUS_SYNC = -1;

export interface SyncThrottleInput {
  /** Steps reported by the last sync this session, or NO_PREVIOUS_SYNC. */
  lastSyncedSteps: number;
  /** Steps the pending sync would report. */
  currentSteps: number;
  /** Milliseconds since the last sync this session. */
  timeSinceLastSync: number;
}

/**
 * Whether a foreground sync should go out now.
 *
 * The first sync of a session always fires: there is no previous figure to
 * compare against, and the server needs to hear from a freshly opened app even
 * if the count has not moved since the last session.
 *
 * After that, BOTH conditions must hold — enough time has passed AND the count
 * has actually moved. Requiring only one of them is what produced the sync
 * bursts described at the top of this file.
 */
export function shouldSyncNow({
  lastSyncedSteps,
  currentSteps,
  timeSinceLastSync,
}: SyncThrottleInput): boolean {
  if (lastSyncedSteps === NO_PREVIOUS_SYNC) return true;

  const enoughTime = timeSinceLastSync >= MIN_SYNC_INTERVAL_MS;
  const moved = Math.abs(currentSteps - lastSyncedSteps) >= MIN_STEP_DELTA;

  return enoughTime && moved;
}
