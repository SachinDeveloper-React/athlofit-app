/**
 * healthConnect.service.ts
 *
 * Android 15+ — reads Steps directly from Health Connect (written by the
 * Android platform's built-in step sensor / Google Fit background service).
 * Derives calories, distance, and active minutes from the step count and
 * writes them back to Health Connect so every metric is visible in one place.
 *
 * NO external sensor libraries required — react-native-health-connect only.
 */

import {
  initialize,
  requestPermission,
  readRecords,
  insertRecords,
  deleteRecordsByTimeRange,
  getSdkStatus,
  getGrantedPermissions,
  SdkAvailabilityStatus,
  BackgroundAccessPermission,
  Permission,
} from 'react-native-health-connect';
import { HealthData, defaultHealthData } from '../types/healthTypes';

// ─── Derivation constants ─────────────────────────────────────────────────────
const DEFAULT_WEIGHT_KG = 70;
const STRIDE_MALE_M = 0.78;   // average male stride length in metres
const STRIDE_FEMALE_M = 0.70; // average female stride length in metres
const KCAL_PER_STEP = (kg: number) => (kg * 0.57) / 1000; // MET-based formula
const STEPS_PER_MINUTE = 100; // average walking cadence

export type GenderForStride = 'M' | 'F' | 'O' | null | undefined;

/** Returns stride length in metres based on gender. Defaults to male (0.78m). */
const getStrideM = (gender?: GenderForStride): number =>
  gender === 'F' ? STRIDE_FEMALE_M : STRIDE_MALE_M;

export const deriveFromSteps = (
  steps: number,
  weightKg = DEFAULT_WEIGHT_KG,
  gender?: GenderForStride,
) => ({
  calories: Math.round(steps * KCAL_PER_STEP(weightKg)),
  distanceKm: Math.round(steps * (getStrideM(gender) / 1000) * 100) / 100,
  activeMinutes: Math.round(steps / STEPS_PER_MINUTE),
});

// ─── Permissions ──────────────────────────────────────────────────────────────
//
// Only request what the app actually reads or writes.
// Derived metrics (calories, distance, exercise) are WRITTEN back to HC
// so they appear in the Health Connect UI — but we never READ them (we
// derive them from steps on every fetch instead).
// Height is never read or written by this app.
//
const PERMISSIONS: (Permission | BackgroundAccessPermission)[] = [
  // ── Activity ──────────────────────────────────────────────────────────────
  { accessType: 'read',  recordType: 'Steps' },
  { accessType: 'write', recordType: 'Steps' },
  // Write permission needed for native step counter on pre-Android 14 devices
  // to insert hardware sensor steps into Health Connect.

  // Derived metrics — write-only (we compute from steps, never read back)
  { accessType: 'write', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'write', recordType: 'Distance' },
  { accessType: 'write', recordType: 'ExerciseSession' },

  // ── Vitals ────────────────────────────────────────────────────────────────
  { accessType: 'read',  recordType: 'HeartRate' },
  { accessType: 'write', recordType: 'HeartRate' },

  { accessType: 'read',  recordType: 'BloodPressure' },
  { accessType: 'write', recordType: 'BloodPressure' },

  { accessType: 'read',  recordType: 'Weight' },
  { accessType: 'write', recordType: 'Weight' },

  // ── Hydration ─────────────────────────────────────────────────────────────
  { accessType: 'read',  recordType: 'Hydration' },
  { accessType: 'write', recordType: 'Hydration' },

  // ── Background ────────────────────────────────────────────────────────────
  { accessType: 'read',  recordType: 'BackgroundAccessPermission' },
];

// ─── Init ─────────────────────────────────────────────────────────────────────

export const isHealthConnectAvailable = async (): Promise<boolean> => {
  const status = await getSdkStatus();
  return status === SdkAvailabilityStatus.SDK_AVAILABLE;
};

/**
 * Check if Health Connect permissions are already granted (no UI prompt).
 * Returns true if at least 80% of required permissions are granted.
 */
export const hasHealthConnectPermissions = async (): Promise<boolean> => {
  try {
    const initialized = await initialize();
    if (!initialized) return false;
    const granted = await getGrantedPermissions();
    return granted.length >= PERMISSIONS.length * 0.8;
  } catch {
    return false;
  }
};

/** Small delay after initialize() to let the IPC binding fully settle.
 *  Without this, concurrent readRecords calls immediately after init
 *  cause RemoteException: Binding died / Null binding errors. */
const sleep = (ms: number) => new Promise((resolve: any) => setTimeout(resolve, ms));

export const initializeHealthConnect = async (): Promise<boolean> => {
  const initialized = await initialize();
  if (!initialized) return false;
  // Give the Health Connect service time to fully bind before any reads
  await sleep(300);
  const granted = await requestPermission(PERMISSIONS);
  // Accept if at least 80% of permissions were granted
  const success = granted.length >= PERMISSIONS.length * 0.8;

  // FIX: Clean up any stale step records written by our app to Health Connect.
  // The native StepCounterService previously wrote steps under our package name,
  // which caused a circular inflation loop. Delete those records so affected
  // users immediately get correct step counts.
  if (success) {
    cleanupOwnStepRecords().catch(e =>
      console.warn('[HealthConnect] cleanup own step records failed:', e)
    );
  }

  return success;
};

/**
 * Deletes all StepsRecord entries written by our own app (com.athlofit.athlofit)
 * from Health Connect for today. This fixes the inflation issue for users who
 * already have stale/inflated records from the old write behavior.
 *
 * Safe to call multiple times — no-ops if no records exist.
 */
async function cleanupOwnStepRecords(): Promise<void> {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const now = new Date();

    const { records } = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between' as const,
        startTime: startOfDay.toISOString(),
        endTime: now.toISOString(),
      },
    });

    if (!records || records.length === 0) return;

    const OWN_PACKAGE = 'com.athlofit.athlofit';
    const ownRecordIds: string[] = [];

    for (const r of records) {
      const origin = (r as any).metadata?.dataOrigin ?? '';
      const id = (r as any).metadata?.id;
      if (origin === OWN_PACKAGE && id) {
        ownRecordIds.push(id);
      }
    }

    if (ownRecordIds.length === 0) {
      console.log('[HealthConnect] No own step records to clean up');
      return;
    }

    // Delete our own step records using time range (deleteRecordsByTimeRange
    // deletes ALL records of that type within the range that our app owns)
    await deleteRecordsByTimeRange('Steps', {
      operator: 'between' as const,
      startTime: startOfDay.toISOString(),
      endTime: now.toISOString(),
    });

    console.log(`[HealthConnect] Cleaned up ${ownRecordIds.length} own step records from Health Connect`);
  } catch (e) {
    console.warn('[HealthConnect] cleanupOwnStepRecords error:', e);
  }
}

// ─── Retry helper ─────────────────────────────────────────────────────────────
//
// RemoteException (Binding died / Null binding / Binding to service failed)
// is a transient IPC error — the Health Connect service process restarted.
// Retrying after a short back-off resolves it in virtually all cases.
//
async function readWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 400,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      const isBindingError =
        typeof e?.message === 'string' &&
        (e.message.includes('Binding died') ||
          e.message.includes('Binding to service failed') ||
          e.message.includes('Null binding') ||
          e.message.includes('RemoteException'));
      if (!isBindingError || attempt === retries - 1) throw e;
      // Exponential back-off: 400ms, 800ms, 1600ms …
      await sleep(delayMs * Math.pow(2, attempt));
    }
  }
  throw lastError;
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

export const todayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return {
    operator: 'between' as const,
    startTime: start.toISOString(),
    endTime: new Date().toISOString(),
  };
};

/**
 * @deprecated Do not use this for steps. Kept only as a warning marker.
 *
 * This returned `loginTimestamp → now` when the user had logged in today, so
 * Health Connect reported only post-login steps. The pre-login part of the day
 * then had to be recovered by ADDING the server's stored total, and that addition
 * was the root of the step inflation: Health Connect is populated by the platform
 * pedometer regardless of whether anyone is signed in, so it already had the whole
 * day. The "gap" the addition filled did not exist.
 *
 * Steps now always use {@link todayRange}. If you need to avoid attributing
 * historical data to a new account, filter by the account creation DATE on the
 * server, not by a within-day timestamp on the client.
 */
export const sinceLoginRange = (
  _loginTimestamp: number | null,
  _accountCreatedAt?: string | null,
) => todayRange();

export const lastNDays = (n: number) => ({
  operator: 'between' as const,
  startTime: new Date(Date.now() - n * 86400000).toISOString(),
  endTime: new Date().toISOString(),
});

// ─── Write derived metrics back to Health Connect ─────────────────────────────
//
//  Delete today's previously derived records first, then insert fresh ones.
//  This prevents values from multiplying on every refresh.
//
// FIX #3: Track last written step count to skip redundant delete+insert cycles.
let _lastDerivedWriteSteps: number = 0;

export const writeDerivedActivity = async (
  steps: number,
  weightKg = DEFAULT_WEIGHT_KG,
  gender?: GenderForStride,
): Promise<void> => {
  if (steps <= 0) return;

  // FIX #3: Skip if steps haven't changed since last write — avoids unnecessary
  // delete+insert of calories/distance/exercise records on every 90s poll.
  if (steps === _lastDerivedWriteSteps) return;
  _lastDerivedWriteSteps = steps;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const now = new Date();
  const todayFilter = {
    operator: 'between' as const,
    startTime: startOfDay.toISOString(),
    endTime: now.toISOString(),
  };

  const { calories, distanceKm, activeMinutes } = deriveFromSteps(
    steps,
    weightKg,
    gender,
  );

  const sessionEnd = new Date(
    Math.max(now.getTime(), startOfDay.getTime() + 60_000),
  );

  // Step 1 — delete today's existing derived records so we don't accumulate
  await Promise.all([
    deleteRecordsByTimeRange('ActiveCaloriesBurned', todayFilter).catch(
      () => {},
    ),
    deleteRecordsByTimeRange('Distance', todayFilter).catch(() => {}),
    deleteRecordsByTimeRange('ExerciseSession', todayFilter).catch(() => {}),
  ]);

  // Step 2 — insert fresh derived values
  await insertRecords([
    {
      recordType: 'ActiveCaloriesBurned',
      energy: { value: calories, unit: 'kilocalories' },
      startTime: startOfDay.toISOString(),
      endTime: now.toISOString(),
    },
  ]);

  await insertRecords([
    {
      recordType: 'Distance',
      distance: { value: distanceKm, unit: 'kilometers' },
      startTime: startOfDay.toISOString(),
      endTime: now.toISOString(),
    },
  ]);

  await insertRecords([
    {
      recordType: 'ExerciseSession',
      exerciseType: 56, // WALKING
      title: 'Daily Walking',
      startTime: startOfDay.toISOString(),
      endTime: sessionEnd.toISOString(),
    },
  ]);
};

// ─── Step deduplication ───────────────────────────────────────────────────────
//
// Health Connect can have steps from MULTIPLE data origins — Samsung Health,
// Google Fit, platform sensor, third-party apps like Sweatcoin, etc.
//
// aggregateRecord() sums all sources, which inflates the count on Samsung
// devices where Samsung Health and the platform sensor both write steps.
//
// Two overlapping sources are almost always the SAME walk recorded twice; two
// sources covering different parts of the day (a phone and a paired watch) are
// different walks that must be added. So the question the dedup has to answer is
// "did these origins record at the same TIME?", which is what the coverage rule
// below measures.
//
// ── Why the previous time-slot version over-reported ─────────────────────────
//
// It split the day into 30-minute slots, took the largest origin in each slot and
// summed the slots, then clamped the result to [largestOrigin, originSum].
//
// A multi-slot record was spread across its slots in proportion to its duration.
// That is a fair comparison only if steps really are uniform across the record,
// and for a long AGGREGATE record they are not: Samsung Health writes one record
// covering the whole waking day, so 22,000 steps became ~647 in every 30-minute
// slot from 06:00 to 23:00 — including the hours the user was sitting still.
//
// The platform sensor's granular records then won the slots where the user
// actually walked, and Samsung's phantom ~647/slot won every other slot. The two
// sets of wins were added together, so the SAME 22,000 steps were reported as
// 37,529 — a 1.7x inflation.
//
// The `Math.min(originSum, ...)` clamp could not catch it, because `originSum` is
// the sum of the duplicates (44,000 here) — it is precisely the number the dedup
// exists to avoid, so it bounded nothing.
//
// Those inflated totals were POSTed to the server, cleared its rate limits (they
// are physically possible figures), and minted passive step coins for steps that
// were never walked.
//
// ── What replaces it ─────────────────────────────────────────────────────────
//
// Compare the TIME each origin covers rather than guessing where inside a record
// its steps fell — the record boundaries are real data, the distribution inside
// them is not. The origin with the highest total is the primary source; any other
// origin is added only when its recording time barely overlaps the primary's,
// which is the paired-device case. An origin that overlaps the primary is a
// mirror of it and contributes nothing.
//
// This is bounded by [largestOrigin, originSum] by construction, and it agrees
// with the native HealthSyncHelper.kt, which now applies the same rule.
//

/** Our own package — records we wrote are never counted as a data source. */
export const OWN_PACKAGE = 'com.athlofit.athlofit';

/**
 * How much of an origin's recording time must fall OUTSIDE the primary source's
 * before we believe it is an independent device rather than a mirror.
 *
 * Set high deliberately. Mistaking a mirror for a second device inflates the
 * count and mints coins; mistaking a second device for a mirror loses some steps
 * for a user who owns two. Only the first costs real money, so the threshold is
 * placed where a partial overlap resolves to "mirror".
 */
const DISJOINT_COVERAGE_MIN = 0.9;

/**
 * Minimum span given to a zero-length record when measuring coverage. Some
 * writers log instantaneous records; without this they would have no coverage at
 * all and could never be judged disjoint.
 */
const MIN_RECORD_SPAN_MS = 60 * 1000;

export interface StepOriginTotal {
  packageName: string;
  steps: number;
}

export interface StepsReadResult {
  /** Deduplicated step total for the requested window. */
  steps: number;
  /**
   * False when the Health Connect read itself failed. Callers must treat this as
   * "no information" rather than "zero steps" — reporting 0 for a failed read is
   * what used to make the count collapse and then get papered over by a floor.
   */
  available: boolean;
  /** Per-origin totals, including our own package, for diagnostics. */
  origins: StepOriginTotal[];
  /** Largest single external origin — the guaranteed lower bound of `steps`. */
  largestOrigin: number;
  /** Sum of all external origins — the guaranteed upper bound of `steps`. */
  originSum: number;
  /** How the value was derived, surfaced in the debug screen. */
  method: 'single-origin' | 'coverage-dedup' | 'own-records-only' | 'no-records' | 'failed';

  // ── Provenance ──────────────────────────────────────────────────────────────
  //
  // Everything below describes WHERE the steps in `steps` came from, and is
  // carried to the server on the next sync (see stepProvenance.ts). None of it
  // affects `steps`; it exists so that a step total can be explained afterwards
  // rather than argued about. Before it, the reader computed all of this and
  // then discarded it at the call site, so the server saw only a number and a
  // 17,000-step jump had no available explanation.

  /** The dedup verdict per non-primary origin: added, or judged a mirror. */
  contributions: OriginContribution[];
  /** Package the dedup used as the baseline — most steps are attributable to it. */
  primaryOrigin: string;

  /**
   * Steps per LOCAL hour of the day, index 0 = 00:00–00:59, built from the
   * timestamps of the records that actually contributed.
   *
   * This is the single most useful field here, because it separates the two
   * explanations of a large jump that otherwise look identical in the daily
   * total: steps walked across the whole day and delivered in one late sync
   * (spread across many hours), versus steps that appeared all at once inside
   * one short record (a counting bug, or another app writing a bulk entry).
   */
  hourly: number[];

  /** Earliest record start and latest record end behind `steps`, ISO. */
  recordedFrom: string | null;
  recordedTo: string | null;
  /** How many underlying Health Connect records `steps` was built from. */
  recordCount: number;
}

// ─── Coverage helpers ─────────────────────────────────────────────────────────
// Plain interval arithmetic over [start, end) pairs in epoch milliseconds. Kept
// module-level and pure so the dedup can be unit-tested without Health Connect.

type Interval = [start: number, end: number];

/** Sorts and merges overlapping/touching intervals into a disjoint set. */
function mergeIntervals(intervals: Interval[]): Interval[] {
  if (!intervals.length) return [];
  const sorted = intervals
    .map(([a, b]): Interval => [a, Math.max(b, a + MIN_RECORD_SPAN_MS)])
    .sort((a, b) => a[0] - b[0]);

  const merged: Interval[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i][0] <= last[1]) last[1] = Math.max(last[1], sorted[i][1]);
    else merged.push(sorted[i]);
  }
  return merged;
}

/** Total milliseconds spanned by a disjoint interval set. */
function coveredMs(intervals: Interval[]): number {
  return intervals.reduce((sum, [a, b]) => sum + (b - a), 0);
}

/** Milliseconds present in BOTH disjoint interval sets. */
function intersectionMs(a: Interval[], b: Interval[]): number {
  let i = 0;
  let j = 0;
  let sum = 0;
  while (i < a.length && j < b.length) {
    const lo = Math.max(a[i][0], b[j][0]);
    const hi = Math.min(a[i][1], b[j][1]);
    if (hi > lo) sum += hi - lo;
    if (a[i][1] < b[j][1]) i++;
    else j++;
  }
  return sum;
}

/** One step record, reduced to the fields the dedup actually reasons about. */
export interface StepRecordLite {
  origin: string;
  count: number;
  /** Epoch milliseconds. */
  start: number;
  /** Epoch milliseconds. */
  end: number;
}

export interface OriginContribution {
  packageName: string;
  steps: number;
  /** Fraction of this origin's recording time not shared with the primary source. */
  disjointFraction: number;
  /** Steps this origin actually added on top of the primary. */
  contributed: number;
}

export interface CoverageDedupResult {
  steps: number;
  largestOrigin: number;
  originSum: number;
  /** Package name of the origin used as the baseline. */
  primaryOrigin: string;
  /** Every non-primary origin and what it was judged to be. */
  contributions: OriginContribution[];
}

/**
 * Deduplicates step records across data origins using time coverage.
 *
 * Pure and deterministic: same records in, same number out. No I/O, no clock, no
 * module state — the properties that make the result auditable and testable.
 *
 * The origin with the most steps is the baseline. Every other origin is added
 * only in proportion to the recording time it does NOT share with that baseline,
 * and only when that share is at least {@link DISJOINT_COVERAGE_MIN} — a source
 * that recorded alongside the baseline is a mirror of it, not extra steps.
 *
 * Guarantees, by construction:
 *   * `steps >= largestOrigin` — the biggest single source genuinely recorded
 *     that many, so the total can never fall below it.
 *   * `steps <= originSum` — a deduplicated total is a subset of the raw sum.
 */
export function dedupeStepsAcrossOrigins(
  records: StepRecordLite[],
): CoverageDedupResult {
  const totals: Record<string, number> = {};
  const intervalsByOrigin: Record<string, Interval[]> = {};

  for (const r of records) {
    const count = Math.max(0, r.count || 0);
    totals[r.origin] = (totals[r.origin] ?? 0) + count;
    if (count === 0) continue;
    (intervalsByOrigin[r.origin] ??= []).push([r.start, Math.max(r.end, r.start)]);
  }

  const originNames = Object.keys(totals);
  if (!originNames.length) {
    return {
      steps: 0, largestOrigin: 0, originSum: 0,
      primaryOrigin: '', contributions: [],
    };
  }

  const originSum = originNames.reduce((sum, o) => sum + totals[o], 0);
  const largestOrigin = Math.max(...originNames.map(o => totals[o]));

  // Ties broken by package name so the result does not depend on record order.
  const primaryOrigin = originNames
    .filter(o => totals[o] === largestOrigin)
    .sort()[0];

  const coverage: Record<string, Interval[]> = {};
  for (const o of originNames) coverage[o] = mergeIntervals(intervalsByOrigin[o] ?? []);

  const primaryCoverage = coverage[primaryOrigin];
  const contributions: OriginContribution[] = [];
  let extras = 0;

  for (const o of originNames) {
    if (o === primaryOrigin) continue;

    const ownMs = coveredMs(coverage[o]);
    // No measurable coverage means no evidence of independence — treat as mirror.
    const disjointFraction =
      ownMs > 0 ? 1 - intersectionMs(coverage[o], primaryCoverage) / ownMs : 0;

    const contributed =
      disjointFraction >= DISJOINT_COVERAGE_MIN
        ? Math.round(totals[o] * disjointFraction)
        : 0;

    extras += contributed;
    contributions.push({
      packageName: o, steps: totals[o], disjointFraction, contributed,
    });
  }

  return {
    steps: Math.min(originSum, largestOrigin + extras),
    largestOrigin,
    originSum,
    primaryOrigin,
    contributions,
  };
}

const EMPTY_READ: StepsReadResult = {
  steps: 0, available: true, origins: [], largestOrigin: 0, originSum: 0, method: 'no-records',
  contributions: [], primaryOrigin: '', hourly: [], recordedFrom: null, recordedTo: null,
  recordCount: 0,
};

/**
 * A read that did not happen. `available: false`, so callers treat it as "no
 * information" rather than "zero steps" — the distinction the step engine
 * depends on to fall back to the native sensor instead of collapsing the day.
 *
 * Shared by both failure sites. They were separate literals, which is how one
 * of them could be left behind when the shape gained a field.
 */
const FAILED_READ: StepsReadResult = {
  steps: 0, available: false, origins: [], largestOrigin: 0, originSum: 0, method: 'failed',
  contributions: [], primaryOrigin: '', hourly: [], recordedFrom: null, recordedTo: null,
  recordCount: 0,
};

// ─── Hour attribution ─────────────────────────────────────────────────────────
//
// A Health Connect record is a COUNT OVER A SPAN, not a stamp at an instant.
// A record covering 08:40–09:20 with 400 steps is 200 steps in each of two
// hours, and putting all 400 in whichever hour the record happens to start in
// would misreport exactly the case the histogram exists to detect — a bulk
// record spanning many hours would collapse into one, and look like the burst
// it is meant to distinguish itself from.
//
// So each record is spread across the local hours it spans, in proportion to
// the time it spends in each.

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Distributes step records across the 24 local hours of `dayStart`.
 *
 * Only pass records that CONTRIBUTED to the total. Passing mirrored origins as
 * well would produce a histogram summing to far more than the deduplicated
 * figure it is supposed to describe.
 */
export function bucketStepsByHour(
  records: StepRecordLite[],
  dayStart: number,
): number[] {
  const hours = new Array<number>(24).fill(0);

  for (const r of records) {
    const count = Math.max(0, r.count || 0);
    if (count <= 0) continue;

    const start = r.start;
    // A zero-length record has no span to divide, so it is credited whole to
    // the hour it sits in. Treating it as spanning zero time would drop it.
    const end = Math.max(r.end, r.start);
    const span = end - start;

    if (span <= 0) {
      const h = Math.floor((start - dayStart) / MS_PER_HOUR);
      if (h >= 0 && h < 24) hours[h] += count;
      continue;
    }

    // Walk only the hours the record actually touches, clipped to the day.
    const firstHour = Math.max(0, Math.floor((start - dayStart) / MS_PER_HOUR));
    const lastHour = Math.min(23, Math.floor((end - dayStart) / MS_PER_HOUR));

    for (let h = firstHour; h <= lastHour; h++) {
      const hourStart = dayStart + h * MS_PER_HOUR;
      const overlap =
        Math.min(end, hourStart + MS_PER_HOUR) - Math.max(start, hourStart);
      if (overlap > 0) hours[h] += Math.round((count * overlap) / span);
    }
  }

  return hours;
}

// ─── Read cache ───────────────────────────────────────────────────────────────
// Health Connect reads cross a Binder boundary and can return dozens of records
// on devices with several fitness apps installed, so identical reads within a
// short window are served from memory.
//
// Only SUCCESSFUL reads are cached. Caching a failure used to be actively
// harmful: one transient error produced a bad value that was then served for 30s
// and, because of the old monotonic floor, locked in for the rest of the day.
const STEP_CACHE_TTL_MS = 30_000;
let _stepCache: { key: string; at: number; value: StepsReadResult } | null = null;

/** Reset the step cache — call on midnight reset to prevent stale data leaking. */
export function resetStepCache(): void {
  _stepCache = null;
}

/**
 * Reads today's steps from Health Connect and deduplicates across data origins.
 *
 * ## The problem this solves
 *
 * Health Connect is a shared store. On a typical phone the Steps table contains
 * records from the platform pedometer, possibly Samsung Health or Google Fit, and
 * any third-party app the user installed (Sweatcoin is a common one). Those
 * sources overlap in complicated ways:
 *
 *   * Samsung Health and the platform sensor record THE SAME walk. Summing them
 *     roughly doubles the count.
 *   * A phone and a paired watch record DIFFERENT periods. Taking the max of them
 *     throws away real steps.
 *
 * So neither `aggregateRecord` (which sums everything) nor "largest single origin"
 * is correct on its own. The day is split into 30-minute slots; within a slot the
 * origins are assumed to describe the same activity, so we take the largest
 * origin's total for that slot; across slots the periods are distinct, so we add
 * them up.
 *
 * ## Why the result is bounded
 *
 * The previous implementation compared INDIVIDUAL RECORDS inside a slot instead of
 * each origin's slot total. With one origin writing a single long record and
 * another writing many short ones, the per-slot winner was essentially arbitrary,
 * and the summed result could exceed anything actually present in the data — an
 * unbounded function of its input, which is how it could return several times the
 * largest source.
 *
 * The result is now explicitly clamped to `[largestOrigin, originSum]`:
 *
 *   * It cannot be lower than the biggest single source, since that source alone
 *     genuinely recorded that many steps.
 *   * It cannot be higher than every source added together, since the deduplicated
 *     total is by definition a subset of the raw sum.
 *
 * Those two invariants make over-reporting structurally impossible rather than
 * something to be caught downstream.
 */
export async function readTodayStepsDetailed(
  startTime: string,
  endTime: string,
): Promise<StepsReadResult> {
  const cacheKey = `${startTime}|${endTime}`;
  if (_stepCache && _stepCache.key === cacheKey && Date.now() - _stepCache.at < STEP_CACHE_TTL_MS) {
    return _stepCache.value;
  }

  let result: StepsReadResult;

  try {
    const { records } = await readWithRetry(() =>
      readRecords('Steps', {
        timeRangeFilter: { operator: 'between' as const, startTime, endTime },
      }),
    );

    // ── Midnight bleed guard ─────────────────────────────────────────────────
    // Health Connect returns records that merely OVERLAP the requested window, so
    // a record running 11:55 PM → 12:05 AM shows up in a "today" query. Anything
    // that started before the window belongs to the previous day.
    const requestedStart = new Date(startTime).getTime();
    const inWindow = (records ?? []).filter(
      (r: any) => new Date(r.startTime).getTime() >= requestedStart,
    );

    if (!inWindow.length) {
      result = EMPTY_READ;
    } else {
      // Per-origin totals over the whole window.
      const totals: Record<string, number> = {};
      for (const r of inWindow) {
        const origin = (r as any).metadata?.dataOrigin ?? 'unknown';
        totals[origin] = (totals[origin] ?? 0) + Math.max(0, (r as any).count ?? 0);
      }

      const origins: StepOriginTotal[] = Object.entries(totals)
        .map(([packageName, steps]) => ({ packageName, steps }))
        .sort((a, b) => b.steps - a.steps);

      const externalRecords = inWindow.filter(
        (r: any) => ((r as any).metadata?.dataOrigin ?? 'unknown') !== OWN_PACKAGE,
      );
      const externalOrigins = origins.filter(o => o.packageName !== OWN_PACKAGE);

      // ── Provenance scaffolding ───────────────────────────────────────────
      // Reduced once here rather than per-branch, so the hour histogram is
      // built from the same records the total is, and cannot drift from it.
      const lite: StepRecordLite[] = externalRecords.map((r: any) => ({
        origin: r.metadata?.dataOrigin ?? 'unknown',
        count: Math.max(0, r.count ?? 0),
        start: new Date(r.startTime).getTime(),
        end: new Date(r.endTime).getTime(),
      }));
      // Local midnight of the day being read. `startTime` is exactly that for
      // every caller (both readers explicitly start at local midnight), which is
      // what makes the histogram's index a local hour.
      const dayStart = requestedStart;
      const recordedFrom = lite.length
        ? new Date(Math.min(...lite.map(r => r.start))).toISOString()
        : null;
      const recordedTo = lite.length
        ? new Date(Math.max(...lite.map(r => r.end))).toISOString()
        : null;
      const recordCount = externalRecords.length;

      if (externalOrigins.length === 0) {
        // Only our own historical records exist. Older builds wrote steps back
        // into Health Connect, which made the app read its own output; those
        // records are no longer written but may still be on the device. Report
        // them so the day is not blank, and label it clearly.
        const own = Math.max(0, ...origins.map(o => o.steps));
        const ownLite: StepRecordLite[] = inWindow.map((r: any) => ({
          origin: r.metadata?.dataOrigin ?? 'unknown',
          count: Math.max(0, r.count ?? 0),
          start: new Date(r.startTime).getTime(),
          end: new Date(r.endTime).getTime(),
        }));
        result = {
          steps: own, available: true, origins,
          largestOrigin: own, originSum: own, method: 'own-records-only',
          contributions: [], primaryOrigin: OWN_PACKAGE,
          hourly: bucketStepsByHour(ownLite, dayStart),
          recordedFrom: ownLite.length
            ? new Date(Math.min(...ownLite.map(r => r.start))).toISOString()
            : null,
          recordedTo: ownLite.length
            ? new Date(Math.max(...ownLite.map(r => r.end))).toISOString()
            : null,
          recordCount: inWindow.length,
        };
      } else {
        const largestOrigin = Math.max(...externalOrigins.map(o => o.steps));
        const originSum = externalOrigins.reduce((sum, o) => sum + o.steps, 0);

        if (externalOrigins.length === 1) {
          // One source: its own total is the answer, no dedup needed.
          result = {
            steps: largestOrigin, available: true, origins,
            largestOrigin, originSum, method: 'single-origin',
            contributions: [], primaryOrigin: externalOrigins[0].packageName,
            hourly: bucketStepsByHour(lite, dayStart),
            recordedFrom, recordedTo, recordCount,
          };
        } else {
          // ── Coverage-based deduplication ───────────────────────────────────
          // See the note above dedupeStepsAcrossOrigins for why this compares
          // recording TIME rather than splitting records across time slots.
          const dedup = dedupeStepsAcrossOrigins(lite);

          // The histogram is built from the records that were actually COUNTED
          // — the primary origin plus any origin judged independent. Including
          // a mirrored origin would make the hours sum to roughly double the
          // deduplicated total they are supposed to describe, which would turn
          // the one field that explains a jump into another thing to explain.
          const countedOrigins = new Set<string>([
            dedup.primaryOrigin,
            ...dedup.contributions.filter(c => c.contributed > 0).map(c => c.packageName),
          ]);

          result = {
            steps: dedup.steps, available: true, origins,
            largestOrigin, originSum, method: 'coverage-dedup',
            contributions: dedup.contributions,
            primaryOrigin: dedup.primaryOrigin,
            hourly: bucketStepsByHour(
              lite.filter(r => countedOrigins.has(r.origin)),
              dayStart,
            ),
            recordedFrom, recordedTo, recordCount,
          };

          const added = dedup.contributions
            .filter(c => c.contributed > 0)
            .map(c => `${c.packageName} +${c.contributed}`);
          const mirrored = dedup.contributions
            .filter(c => c.contributed === 0)
            .map(c => `${c.packageName} (${c.steps}, ${Math.round(c.disjointFraction * 100)}% disjoint)`);

          console.log(
            `[HealthConnect] Steps dedup: primary=${dedup.primaryOrigin} ${largestOrigin}` +
            `${added.length ? `, added ${added.join(', ')}` : ''}` +
            `${mirrored.length ? `, treated as mirrors: ${mirrored.join(', ')}` : ''}` +
            ` → ${dedup.steps} (raw sum would be ${originSum})`,
          );
        }
      }
    }

    _stepCache = { key: cacheKey, at: Date.now(), value: result };
    return result;
  } catch (e) {
    // Deliberately no aggregateRecord fallback. `aggregateRecord` sums every
    // origin including our own package, so it returns precisely the inflated
    // number this function exists to avoid — and the old code cached it.
    // Reporting the read as unavailable lets the step engine fall back to the
    // other sources instead of accepting a wrong value.
    console.warn('[HealthConnect] Steps read failed — reporting source unavailable:', e);
    return FAILED_READ;
  }
}

/**
 * Numeric convenience wrapper around {@link readTodayStepsDetailed}.
 * Returns 0 for a failed read, so only use it where "no data" and "zero steps"
 * are interchangeable (background sync, dev tooling).
 */
export async function readStepsDeduped(
  startTime: string,
  endTime: string,
): Promise<number> {
  const { steps } = await readTodayStepsDetailed(startTime, endTime);
  return steps;
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

/** Health data plus the provenance of the step figure inside it. */
export interface HealthConnectFetchResult extends HealthData {
  /** Full detail of how `steps` was derived. Consumed by the step engine. */
  stepRead: StepsReadResult;
}

export const fetchAllHealthConnectData = async (
  weightKg = DEFAULT_WEIGHT_KG,
  _loginTimestamp: number | null = null,
  gender?: GenderForStride,
  _accountCreatedAt?: string | null,
): Promise<HealthConnectFetchResult> => {
  try {
    // ── Steps are always read for the FULL local day ────────────────────────
    // This used to read from `loginTimestamp` onwards, which meant that after a
    // mid-day login Health Connect reported only post-login steps. The missing
    // earlier steps then had to be recovered by ADDING the server's stored total,
    // and that addition is what double counted: Health Connect already contains
    // the whole day regardless of when the user signed in, because the platform
    // pedometer writes continuously and independently of our app.
    //
    // Reading midnight → now removes the need for any additive path, which in
    // turn removes the need for the "is login recent", "does HC have full day",
    // and inflation-guard heuristics that used to surround it.
    const stepsTimeRange = todayRange();

    const [
      stepRead,
      hrRecords,
      bpRecords,
      weightRecords,
      hydrationRecord,
    ] = await Promise.all([
      readTodayStepsDetailed(stepsTimeRange.startTime, stepsTimeRange.endTime),

      readWithRetry(() => readRecords('HeartRate', { timeRangeFilter: lastNDays(1) })).catch(e => {
        console.warn('HeartRate read failed:', e);
        return { records: [] };
      }),

      readWithRetry(() => readRecords('BloodPressure', { timeRangeFilter: lastNDays(7) })).catch(e => {
        console.warn('BloodPressure read failed:', e);
        return { records: [] };
      }),

      readWithRetry(() => readRecords('Weight', { timeRangeFilter: lastNDays(30) })).catch(e => {
        console.warn('Weight read failed:', e);
        return { records: [] };
      }),

      readWithRetry(() => readRecords('Hydration', { timeRangeFilter: todayRange() })).catch(e => {
        console.warn('Hydration read failed:', e);
        return { records: [] };
      }),
    ]);


  //    readRecords('Steps', {
  //   timeRangeFilter: {
  //     operator: 'between',
  //        startTime: stepsTimeRange.startTime,
  //         endTime:   stepsTimeRange.endTime,
  //   },
  // }).then(({ records }) => {
  //   console.log('Retrieved records: ', JSON.stringify({ records }, null, 2)); // Retrieved records:  {"records":[{"startTime":"2023-01-09T12:00:00.405Z","endTime":"2023-01-09T23:53:15.405Z","energy":{"inCalories":15000000,"inJoules":62760000.00989097,"inKilojoules":62760.00000989097,"inKilocalories":15000},"metadata":{"id":"239a8cfd-990d-42fc-bffc-c494b829e8e1","lastModifiedTime":"2023-01-17T21:06:23.335Z","clientRecordId":null,"dataOrigin":"com.healthconnectexample","clientRecordVersion":0,"device":0}}]}
  // });

  
    // ── Steps ─────────────────────────────────────────────────────────────
    const steps: number = stepRead.steps;
    console.log(
      `[HealthConnect] Steps: ${steps} (${stepRead.method}, available=${stepRead.available}) ` +
      `since ${stepsTimeRange.startTime}`,
    );

    // ── Always derive calories / distance / activeMinutes from steps ────────
    // This ensures values are always consistent with current step count,
    // never stale from a previous session's written records.
    const derived = deriveFromSteps(steps, weightKg, gender);
    const calories = derived.calories;
    const distance = derived.distanceKm;
    const activeMinutes = derived.activeMinutes;

    // ── Heart rate ─────────────────────────────────────────────────────────
    // Use last 24h of records to capture smartwatch data that spans midnight.
    // Prefer today's samples for the average, but show the most recent reading
    // if no data exists for today (common with smartwatches that sync periodically).
    const allSamples = hrRecords.records.flatMap(r => r.samples ?? []);
    const bpms = allSamples.map(s => s.beatsPerMinute);

    // Filter to only today's samples for the average display
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todaySamples = allSamples.filter(s => {
      const sampleTime = new Date(s.time).getTime();
      return sampleTime >= startOfToday.getTime();
    });
    const todayBpms = todaySamples.map(s => s.beatsPerMinute);

    // Use today's readings if available, otherwise fall back to all 24h readings
    const effectiveBpms = todayBpms.length > 0 ? todayBpms : bpms;
    const hrAvg = effectiveBpms.length
      ? Math.round(effectiveBpms.reduce((a, b) => a + b, 0) / effectiveBpms.length)
      : 0;

    console.log(`[HealthConnect] HR: ${hrRecords.records.length} records, ${allSamples.length} total samples, ${todaySamples.length} today samples, avg=${hrAvg}`);
    if (hrRecords.records.length > 0 && allSamples.length === 0) {
      console.warn('[HealthConnect] HR records exist but have no samples — smartwatch may use a different record format');
    }
    if (hrRecords.records.length === 0) {
      console.log('[HealthConnect] No HR records found in last 24h. Ensure smartwatch companion app syncs to Health Connect.');
    }

    // ── Blood pressure ─────────────────────────────────────────────────────
    const latestBP = bpRecords.records.at(-1);
    console.log(`[HealthConnect] BP: ${bpRecords.records.length} records in last 7 days, latest=${latestBP ? `${Math.round(latestBP.systolic.inMillimetersOfMercury)}/${Math.round(latestBP.diastolic.inMillimetersOfMercury)}` : 'none'}`);
    if (bpRecords.records.length === 0) {
      console.log('[HealthConnect] No BP records found in last 7 days. Ensure smartwatch companion app syncs BP to Health Connect.');
    }

    // ── Weight ─────────────────────────────────────────────────────────────
    const latestWeight = weightRecords.records.at(-1);

    // ── Hydration ───────────────────────────────────────────────────
    const hydrationMl = hydrationRecord.records.reduce((sum, r) => {
      const liters = r.volume?.inLiters ?? 0;
      return sum + liters * 1000; // convert → ml
    }, 0);

    const result: HealthConnectFetchResult = {
      steps,
      stepRead,
      calories,
      distance,
      activeMinutes,
      heartRate: hrAvg,
      hydration: Math.round(hydrationMl),
      heartRateMin: effectiveBpms.length ? Math.min(...effectiveBpms) : 0,
      heartRateMax: effectiveBpms.length ? Math.max(...effectiveBpms) : 0,
      bloodPressureSystolic: latestBP
        ? Math.round(latestBP.systolic.inMillimetersOfMercury)
        : 0,
      bloodPressureDiastolic: latestBP
        ? Math.round(latestBP.diastolic.inMillimetersOfMercury)
        : 0,
      sleepHours: 0,
      weight: latestWeight
        ? Math.round(latestWeight.weight.inKilograms * 10) / 10
        : 0,
      bloodGlucose: 0,
    };

    console.log('Health data fetched:', result);

    // Write derived records back so they persist in Health Connect
    // (fire-and-forget — don't await so it doesn't block the UI)
    writeDerivedActivity(steps, weightKg, gender).catch(e =>
      console.warn('writeDerivedActivity failed:', e),
    );

    return result;
  } catch (e) {
    console.error('fetchAllHealthConnectData failed:', e);
    // Mark steps unavailable rather than 0 so the step engine falls back to the
    // native sensor instead of treating a failed fetch as "the user walked 0".
    return {
      ...defaultHealthData,
      stepRead: FAILED_READ,
    };
  }
};

// ─── Manual write helpers ─────────────────────────────────────────────────────

export const writeWeightHC = async (kg: number, time: Date): Promise<void> => {
  await insertRecords([
    {
      recordType: 'Weight',
      weight: { value: kg, unit: 'kilograms' },
      time: time.toISOString(),
    },
  ]);
};

export const writeHeartRateHC = async (bpm: number): Promise<void> => {
  const now = new Date();
  const start = new Date(now.getTime() - 60_000);
  await insertRecords([
    {
      recordType: 'HeartRate',
      startTime: start.toISOString(),
      endTime: now.toISOString(),
      samples: [{ time: now.toISOString(), beatsPerMinute: bpm }],
    },
  ]);
};

// ─── BloodPressure enum values ────────────────────────────────────────────────
// bodyPosition:        0=UNKNOWN 1=STANDING_UP 2=SITTING_DOWN 3=LYING_DOWN 4=RECLINING
// measurementLocation: 0=UNKNOWN 1=LEFT_WRIST  2=RIGHT_WRIST  3=LEFT_UPPER_ARM 4=RIGHT_UPPER_ARM
export const writeBloodPressureHC = async (
  systolic: number,
  diastolic: number,
): Promise<void> => {
  await insertRecords([
    {
      recordType: 'BloodPressure',
      systolic: { value: systolic, unit: 'millimetersOfMercury' },
      diastolic: { value: diastolic, unit: 'millimetersOfMercury' },
      time: new Date().toISOString(),
      bodyPosition: 0, // UNKNOWN
      measurementLocation: 0, // UNKNOWN
    },
  ]);
};

/** @deprecated Do not write Steps — it creates a second source that inflates aggregate() counts. */
export const writeStepsHC = async (
  count: number,
  start: Date,
  end: Date,
): Promise<void> => {
  // No-op: writing Steps from the app causes double-counting in aggregate().
  // The platform step counter (com.google.android.gms etc.) is the only
  // authoritative source and writes steps automatically.
  console.warn('[writeStepsHC] Skipped — app must not write Steps to Health Connect');
};

export const writeHydrationHC = async (
  ml: number,
  start: Date,
  end: Date,
): Promise<void> => {
  await insertRecords([
    {
      recordType: 'Hydration',
      volume: {
        unit: 'liters',
        value: ml / 1000, // ✅ convert ml → liters
      },
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    },
  ]);
};
