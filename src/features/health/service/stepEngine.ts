// ─── stepEngine.ts ────────────────────────────────────────────────────────────
//
// SINGLE SOURCE OF TRUTH for "how many steps did the user walk today".
//
// ## Why this file exists
//
// The step count used to be assembled in several places at once: `loadData`
// combined Health Connect with a server baseline (sometimes with `max`, sometimes
// by ADDING them), `onStepUpdate` added native sensor deltas on top of whatever
// was already on screen, and a module-level "never decrease" floor re-applied the
// previous value on every cycle. Each of those steps was individually defensible
// and collectively they formed a ratchet: any single bad reading became the new
// permanent minimum for the rest of the day, got persisted to MMKV, synced to the
// server, and read back on the next login as a baseline. That is how a device
// whose sources reported 1,720 / 571 steps ended up displaying 7,097.
//
// ## The rule now
//
// `resolveSteps` is a PURE function. Today's step count is recomputed from the
// current readings every single time, and nothing else. There is no stored floor,
// no accumulator, and no additive path. Consequences:
//
//   * The number can only be wrong while a SOURCE is wrong. Fix the source and
//     the display corrects itself on the next cycle — it cannot get stuck.
//   * An already-inflated value (in MMKV, or on the server from an older build)
//     is rejected on the next resolve instead of being preserved forever.
//   * Every decision is auditable: the result carries which source won, which
//     were rejected, and why. StepSourcesScreen renders exactly this, so the
//     debug screen can never disagree with the pipeline again.
//
// ## Source trust model
//
// The sources are not interchangeable, so the cross-checks are deliberately
// asymmetric:
//
//   health_connect  Superset-capable ground truth. It aggregates the platform
//                   pedometer, a paired watch, and other fitness apps, so it may
//                   legitimately be much higher than the phone's own sensor. It is
//                   never rejected by cross-check — only by the absolute/rate
//                   caps. Its internal correctness is enforced at the read site
//                   (`readStepsDeduped` bounds its own output by the per-origin
//                   totals it read).
//
//   native_sensor   Hardware TYPE_STEP_COUNTER on THIS phone. Physically a subset
//                   of Health Connect, because the platform pedometer writes the
//                   same walks into HC. It running far AHEAD of HC therefore means
//                   its `rebootOffset` has drifted, not that the user walked more.
//                   Cross-checked against HC.
//
//   server          The last value some device synced for today. Used only as a
//                   FLOOR, never added, and only when it carries information this
//                   device does not already have (see echo detection below).
//
// ## Echo detection
//
// The server floor exists for real cases: reinstall mid-day, or a second phone.
// But this device also WRITES to that same field, so reading it back can feed the
// device its own output. When the returned value is no higher than what we last
// pushed, it is an echo and carries nothing new, so it is ignored. When it is
// higher, another device or session genuinely contributed and it is trusted.
// `isEcho: null` means we have no record of what we pushed (first run after
// update, or a fresh install) and the ratio fallback below applies instead.

import { getLocalToday } from '../../../utils/date';

/**
 * Absolute ceiling for one day. Deliberately the same number the backend uses in
 * `stepValidation.js` and the client uses in `stepOffset.service.ts`, so a value
 * can never be accepted by one layer and rejected by another.
 *
 * For scale: a marathon is roughly 50,000 steps.
 */
export const MAX_PLAUSIBLE_DAILY_STEPS = 100_000;

/**
 * Sustained cadence ceiling used for the elapsed-time bound. 220/min is a sprint
 * up stairs; nobody holds it, which is what makes it a safe upper bound rather
 * than a target. Matches MAX_STEPS_PER_MINUTE on the backend.
 */
export const MAX_STEPS_PER_MINUTE = 220;

/**
 * Health Connect must be at least this large before it is credible enough to
 * cross-check the native sensor against. Below this the phone may simply not be
 * writing to Health Connect yet, and a low HC value must not veto a working
 * hardware sensor.
 */
const NATIVE_CROSS_CHECK_MIN_HC = 500;

/**
 * How far the native sensor may exceed Health Connect before it is treated as
 * drifted. Health Connect batches its writes, so the sensor legitimately leads by
 * the steps walked in the last few minutes — hundreds at most, never multiples.
 */
const NATIVE_MAX_RATIO_OVER_HC = 2;

/**
 * Local reading required before the server value is ratio-checked. Under this we
 * cannot tell a genuine cross-device carry-over from inflation, and we favour the
 * user by trusting the server.
 */
const SERVER_CROSS_CHECK_MIN_LOCAL = 1_000;

/**
 * How far the server may exceed the best local reading before it is treated as
 * stale/inflated. Only consulted when echo detection is unavailable.
 */
const SERVER_MAX_RATIO_OVER_LOCAL = 3;

/**
 * Slack allowed when comparing the server value against what we last pushed.
 * Covers the backend's own rounding and the bonus-steps arithmetic.
 */
const ECHO_TOLERANCE_STEPS = 150;

export type StepSourceId = 'health_connect' | 'native_sensor' | 'server';

export interface StepSourceInput {
  /** Steps this source reports for today, local midnight → now. */
  steps: number;
  /**
   * False when the read failed or the source does not exist on this device.
   * Unavailable sources are ignored rather than treated as zero, so a failed
   * Health Connect read cannot drag the total down to 0.
   */
  available: boolean;
}

export interface ServerSourceInput extends StepSourceInput {
  /**
   * True  — the value is no higher than what this device last pushed (no new
   *         information, ignore it).
   * False — something else contributed since our last push (trust as a floor).
   * null  — unknown; fall back to the ratio check.
   */
  isEcho: boolean | null;
}

export interface ResolveStepsInput {
  /** Health Connect on Android, HealthKit on iOS. Same role in the model. */
  healthConnect: StepSourceInput;
  nativeSensor: StepSourceInput;
  server: ServerSourceInput;
  /** Admin/system credited steps for today. Display-only, never synced back. */
  bonusSteps: number;
  /**
   * Minutes since local midnight. Bounds the total by what is physically
   * walkable so far today, which catches a full-day value bleeding into the
   * early hours of the next day.
   */
  minutesElapsedToday: number;
}

export interface StepSourceAudit {
  id: StepSourceId;
  steps: number;
  /** Why this source was accepted or rejected, in plain language. */
  reason: string;
}

export interface StepResolution {
  /**
   * Steps walked by the user today, excluding bonus. This is the value that gets
   * synced to the backend — the backend adds bonus itself, so including it here
   * would double count.
   */
  deviceSteps: number;
  /** What the UI shows: deviceSteps + bonusSteps. */
  displaySteps: number;
  bonusSteps: number;
  /** Which source produced `deviceSteps`. */
  winner: StepSourceId | 'none';
  accepted: StepSourceAudit[];
  rejected: StepSourceAudit[];
  /** One-line summary of the decision, for the debug screen and logs. */
  explanation: string;
}

/** Minutes elapsed since local midnight, clamped to a sane range. */
export function minutesSinceLocalMidnight(now: Date = new Date()): number {
  return Math.max(1, now.getHours() * 60 + now.getMinutes() + 1);
}

/**
 * Coerces anything the native/HC/network layers might hand us into a whole,
 * non-negative step count. Guards against NaN, Infinity, negatives, and the -1
 * sentinel the native module uses for "service not running".
 */
function sanitize(steps: unknown): number {
  const n = typeof steps === 'number' ? steps : Number(steps);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}

/**
 * Resolves today's step count from the current readings.
 *
 * Pure: no I/O, no module state, no dependency on previous calls. Given the same
 * readings it always returns the same result, which is what makes the count
 * impossible to ratchet and straightforward to test.
 */
export function resolveSteps(input: ResolveStepsInput): StepResolution {
  const accepted: StepSourceAudit[] = [];
  const rejected: StepSourceAudit[] = [];

  const bonusSteps = sanitize(input.bonusSteps);

  // Physical ceiling for the part of the day that has actually elapsed. Also the
  // reason a stale full-day value cannot survive past midnight: at 00:05 the
  // bound is ~1,300 steps, so yesterday's 12,000 is rejected outright.
  const elapsedBound = Math.min(
    MAX_PLAUSIBLE_DAILY_STEPS,
    Math.max(1, Math.round(input.minutesElapsedToday)) * MAX_STEPS_PER_MINUTE,
  );

  /** Applies the caps every source is subject to, regardless of trust tier. */
  const withinHardLimits = (
    id: StepSourceId,
    source: StepSourceInput,
  ): number | null => {
    if (!source.available) {
      rejected.push({ id, steps: sanitize(source.steps), reason: 'Not available (read failed or source absent)' });
      return null;
    }
    const steps = sanitize(source.steps);
    if (steps === 0) {
      // Zero is not an error, it just carries no information.
      rejected.push({ id, steps: 0, reason: 'Reported 0 steps' });
      return null;
    }
    if (steps > MAX_PLAUSIBLE_DAILY_STEPS) {
      rejected.push({
        id,
        steps,
        reason: `Exceeds the absolute daily limit of ${MAX_PLAUSIBLE_DAILY_STEPS.toLocaleString()}`,
      });
      return null;
    }
    if (steps > elapsedBound) {
      rejected.push({
        id,
        steps,
        reason:
          `Impossible for the time of day — ${steps.toLocaleString()} steps in ` +
          `${Math.round(input.minutesElapsedToday)} min exceeds ${MAX_STEPS_PER_MINUTE} steps/min`,
      });
      return null;
    }
    return steps;
  };

  // ── Tier 1: Health Connect / HealthKit ──────────────────────────────────────
  // Never rejected by cross-check: it can legitimately include a paired watch or
  // another phone's synced data, so there is no local value it must stay under.
  const hcSteps = withinHardLimits('health_connect', input.healthConnect);
  if (hcSteps !== null) {
    accepted.push({ id: 'health_connect', steps: hcSteps, reason: 'Primary source (deduplicated across data origins)' });
  }

  // ── Tier 2: native hardware sensor ──────────────────────────────────────────
  // Cross-checked against Health Connect, because the platform pedometer feeds
  // both. Running far ahead of HC indicates a drifted rebootOffset, which is the
  // exact failure `correctInflatedSteps` exists to repair.
  const nativeRaw = withinHardLimits('native_sensor', input.nativeSensor);
  let nativeSteps: number | null = nativeRaw;
  if (
    nativeRaw !== null &&
    hcSteps !== null &&
    hcSteps >= NATIVE_CROSS_CHECK_MIN_HC &&
    nativeRaw > hcSteps * NATIVE_MAX_RATIO_OVER_HC
  ) {
    nativeSteps = null;
    rejected.push({
      id: 'native_sensor',
      steps: nativeRaw,
      reason:
        `${(nativeRaw / hcSteps).toFixed(1)}x higher than Health Connect ` +
        `(${hcSteps.toLocaleString()}) — hardware counter has drifted`,
    });
  } else if (nativeSteps !== null) {
    accepted.push({ id: 'native_sensor', steps: nativeSteps, reason: 'Hardware pedometer, cross-checked against Health Connect' });
  }

  const localMax = Math.max(hcSteps ?? 0, nativeSteps ?? 0);

  // ── Tier 3: server value, as a floor only ───────────────────────────────────
  const serverRaw = withinHardLimits('server', input.server);
  if (serverRaw !== null) {
    if (input.server.isEcho === true) {
      rejected.push({
        id: 'server',
        steps: serverRaw,
        reason: "Echo of this device's own last sync — carries no new information",
      });
    } else if (
      input.server.isEcho === null &&
      localMax >= SERVER_CROSS_CHECK_MIN_LOCAL &&
      serverRaw > localMax * SERVER_MAX_RATIO_OVER_LOCAL
    ) {
      rejected.push({
        id: 'server',
        steps: serverRaw,
        reason:
          `${(serverRaw / localMax).toFixed(1)}x higher than every local source ` +
          `(${localMax.toLocaleString()}) — stale or inflated record`,
      });
    } else {
      accepted.push({
        id: 'server',
        steps: serverRaw,
        reason: input.server.isEcho === false
          ? 'Floor from another device or session'
          : 'Floor from the server record for today',
      });
    }
  }

  // ── Resolve: highest accepted source wins. No addition, anywhere. ───────────
  let winner: StepSourceId | 'none' = 'none';
  let deviceSteps = 0;
  for (const candidate of accepted) {
    if (candidate.steps > deviceSteps) {
      deviceSteps = candidate.steps;
      winner = candidate.id;
    }
  }

  const explanation = accepted.length === 0
    ? 'No usable source — showing 0'
    : `max(${accepted.map(a => `${labelFor(a.id)} ${a.steps.toLocaleString()}`).join(', ')})` +
      ` = ${deviceSteps.toLocaleString()} from ${labelFor(winner as StepSourceId)}` +
      (bonusSteps > 0 ? ` + ${bonusSteps.toLocaleString()} bonus` : '');

  return {
    deviceSteps,
    displaySteps: deviceSteps + bonusSteps,
    bonusSteps,
    winner,
    accepted,
    rejected,
    explanation,
  };
}

export function labelFor(id: StepSourceId | 'none'): string {
  switch (id) {
    case 'health_connect': return 'Health Connect';
    case 'native_sensor': return 'Native sensor';
    case 'server': return 'Server';
    default: return 'None';
  }
}

/**
 * Decides whether a server step value is just this device's own last sync coming
 * back to it.
 *
 * @param serverSteps      Device steps from the server record (bonus already removed).
 * @param lastPushedSteps  What this device last successfully synced today.
 * @param lastPushedDate   Local date that push belongs to.
 * @returns null when we have no comparable push for today, so the caller falls
 *          back to the ratio check.
 */
export function detectServerEcho(
  serverSteps: number,
  lastPushedSteps: number,
  lastPushedDate: string | null,
): boolean | null {
  if (lastPushedDate !== getLocalToday()) return null;
  if (!Number.isFinite(lastPushedSteps) || lastPushedSteps <= 0) return null;
  return serverSteps <= lastPushedSteps + ECHO_TOLERANCE_STEPS;
}
