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
// Fix: read individual StepsRecord entries, group by dataOrigin, and keep only
// the single source with the highest step count. This mirrors what the native
// HealthSyncHelper.kt does and matches what Samsung Health shows.
//

/** Our own package — records we wrote are never counted as a data source. */
export const OWN_PACKAGE = 'com.athlofit.athlofit';

/** Slot width for time-aware deduplication. */
const DEDUP_SLOT_MS = 30 * 60 * 1000;

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
  method: 'single-origin' | 'time-slot-dedup' | 'own-records-only' | 'no-records' | 'failed';
}

const EMPTY_READ: StepsReadResult = {
  steps: 0, available: true, origins: [], largestOrigin: 0, originSum: 0, method: 'no-records',
};

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

      if (externalOrigins.length === 0) {
        // Only our own historical records exist. Older builds wrote steps back
        // into Health Connect, which made the app read its own output; those
        // records are no longer written but may still be on the device. Report
        // them so the day is not blank, and label it clearly.
        const own = Math.max(0, ...origins.map(o => o.steps));
        result = {
          steps: own, available: true, origins,
          largestOrigin: own, originSum: own, method: 'own-records-only',
        };
      } else {
        const largestOrigin = Math.max(...externalOrigins.map(o => o.steps));
        const originSum = externalOrigins.reduce((sum, o) => sum + o.steps, 0);

        if (externalOrigins.length === 1) {
          // One source: its own total is the answer, no dedup needed.
          result = {
            steps: largestOrigin, available: true, origins,
            largestOrigin, originSum, method: 'single-origin',
          };
        } else {
          // ── Time-slot deduplication ────────────────────────────────────────
          // Build steps-per-origin-per-slot, then take the largest ORIGIN in each
          // slot (not the largest record, which was the bug) and sum the slots.
          const dayStart = new Date(startTime).getTime();
          const dayEnd = new Date(endTime).getTime();
          const numSlots = Math.max(1, Math.ceil((dayEnd - dayStart) / DEDUP_SLOT_MS));

          // slotTotals[slot] = { origin -> steps in that slot }
          const slotTotals: Array<Record<string, number>> = Array.from(
            { length: numSlots }, () => ({}),
          );

          const addToSlot = (slot: number, origin: string, steps: number) => {
            if (slot < 0 || slot >= numSlots || steps <= 0) return;
            slotTotals[slot][origin] = (slotTotals[slot][origin] ?? 0) + steps;
          };

          for (const r of externalRecords) {
            const origin = (r as any).metadata?.dataOrigin ?? 'unknown';
            const count = Math.max(0, (r as any).count ?? 0);
            if (count === 0) continue;

            const recStart = new Date((r as any).startTime).getTime();
            const recEnd = new Date((r as any).endTime).getTime();
            const startSlot = Math.floor((recStart - dayStart) / DEDUP_SLOT_MS);
            const endSlot = Math.floor((Math.max(recEnd, recStart) - dayStart) / DEDUP_SLOT_MS);

            if (startSlot === endSlot || recEnd <= recStart) {
              addToSlot(Math.min(startSlot, numSlots - 1), origin, count);
              continue;
            }

            // Spread a multi-slot record over the slots it covers, in proportion
            // to how much of its duration falls in each. Distributing (rather
            // than assigning it wholesale to one slot) is what lets a long
            // aggregate record from one app be compared fairly against another
            // app's minute-by-minute records.
            const duration = recEnd - recStart;
            for (let s = Math.max(0, startSlot); s <= Math.min(endSlot, numSlots - 1); s++) {
              const slotStart = dayStart + s * DEDUP_SLOT_MS;
              const overlap =
                Math.min(recEnd, slotStart + DEDUP_SLOT_MS) - Math.max(recStart, slotStart);
              if (overlap <= 0) continue;
              addToSlot(s, origin, Math.round(count * (overlap / duration)));
            }
          }

          const dedupTotal = slotTotals.reduce((sum, slot) => {
            const values = Object.values(slot);
            return sum + (values.length ? Math.max(...values) : 0);
          }, 0);

          // Enforce the invariants described above. `originSum` in particular is
          // the ceiling the old implementation lacked.
          const steps = Math.min(originSum, Math.max(largestOrigin, dedupTotal));

          if (dedupTotal > originSum) {
            console.warn(
              `[HealthConnect] Dedup total ${dedupTotal} exceeded the raw origin sum ` +
              `${originSum} — clamped to ${steps}. Origins: ${JSON.stringify(totals)}`,
            );
          }

          result = {
            steps, available: true, origins,
            largestOrigin, originSum, method: 'time-slot-dedup',
          };
          console.log(
            `[HealthConnect] Steps dedup: slots=${dedupTotal}, largest=${largestOrigin}, ` +
            `sum=${originSum} → ${steps}`,
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
    return {
      steps: 0, available: false, origins: [],
      largestOrigin: 0, originSum: 0, method: 'failed',
    };
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
      stepRead: {
        steps: 0, available: false, origins: [],
        largestOrigin: 0, originSum: 0, method: 'failed',
      },
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
