// ─── stepProvenance.ts ────────────────────────────────────────────────────────
//
// Builds the `stepSource` block that rides along with every step sync.
//
// ## Why
//
// The client already knows exactly where a step figure came from. `resolveSteps`
// records which of the three sources won and why the others were rejected;
// `readTodayStepsDetailed` records which Health Connect data origins were read,
// which were judged mirrors of each other, and what clock times the underlying
// records cover. All of it was computed and then dropped at the sync call, so
// the server received a bare integer.
//
// That is why a 17,000-step jump could not be explained. From the server's side
// the two explanations are indistinguishable:
//
//   * The phone was offline for three days, and Health Connect handed over a
//     backlog covering hours 06:00–21:00 recorded by Samsung Health. Real steps,
//     late delivery.
//   * A source over-counted, or another app wrote one bulk record. Not real.
//
// The difference is entirely in the timestamps of the underlying records and in
// how long the device had been silent — both known here, neither previously
// sent. This file packages them.
//
// ## What it is not
//
// Diagnostic only. The server records it and never lets it influence validation,
// clamping, or coins, so nothing here is worth a device lying about. It is
// deliberately small: three scalars, a capped origin list, and a 24-slot
// histogram — a few hundred bytes on a request that already carries a dozen
// health metrics.

import type { StepsReadResult } from './healthConnect.service';
import type { StepResolution, StepSourceId } from './stepEngine';

/** One data origin's contribution, as sent to the server. */
export interface StepSourceOrigin {
  packageName: string;
  /** What this origin reported. */
  steps: number;
  /**
   * What it actually added after deduplication. Zero means it was judged a
   * mirror of the primary origin — it recorded the same walk, so counting it
   * would double the day.
   *
   * Both numbers are sent because their difference is the answer to the most
   * common step complaint. "Samsung Health says 12,000 and the app says 7,000"
   * is answered by a row showing 12,000 reported, 0 contributed: the steps were
   * seen and deliberately not double-counted, which is a completely different
   * answer from never having seen them.
   */
  contributed: number;
  /** Share of this origin's recording time not overlapping the primary's. */
  disjointFraction: number;
}

export interface StepSourcePayload {
  reader: StepSourceId | 'unknown';
  method: string;
  primaryOrigin?: string;
  origins: StepSourceOrigin[];
  /** Steps per local hour, index 0 = 00:00. Omitted when unknown. */
  hourly?: number[];
  recordedFrom?: string;
  recordedTo?: string;
  recordCount?: number;
  /** Minutes since this device last synced successfully. */
  offlineMinutes?: number;
}

/** Cap on origins sent, matching the server's own limit. */
const MAX_ORIGINS = 12;

/**
 * Minutes since `lastSyncedAt`, or undefined when this device has no record of
 * ever syncing.
 *
 * Undefined rather than 0: a fresh install genuinely does not know, and
 * reporting 0 would claim the device had just synced — turning the one field
 * that explains a first-sync backlog into a reason to distrust it.
 */
function offlineMinutesSince(lastSyncedAt: number | null | undefined): number | undefined {
  if (!lastSyncedAt) return undefined;
  const minutes = Math.round((Date.now() - lastSyncedAt) / 60_000);
  return minutes >= 0 ? minutes : undefined;
}

/**
 * Assembles the provenance block for a sync.
 *
 * `resolution` decides the reader, because the reader that WON is the one the
 * synced number came from — `read` may describe a Health Connect read that was
 * then beaten by the native sensor, and attributing the figure to Health
 * Connect in that case would be precisely wrong.
 */
export function buildStepSource({
  read,
  resolution,
  lastSyncedAt,
}: {
  read?: StepsReadResult | null;
  resolution?: StepResolution | null;
  lastSyncedAt?: number | null;
}): StepSourcePayload | undefined {
  const offlineMinutes = offlineMinutesSince(lastSyncedAt);
  const winner = resolution?.winner;

  // ── The figure came from Health Connect ──────────────────────────────────
  // Only then do the origin breakdown and the histogram describe it.
  if (winner === 'health_connect' && read) {
    const contributionBy = new Map(
      (read.contributions ?? []).map(c => [c.packageName, c]),
    );

    const origins: StepSourceOrigin[] = (read.origins ?? [])
      .slice(0, MAX_ORIGINS)
      .map(o => {
        const c = contributionBy.get(o.packageName);
        return {
          packageName: o.packageName,
          steps: o.steps,
          // The primary origin has no contribution row of its own — it IS the
          // baseline, so everything it reported was counted. Without this branch
          // the origin that supplied most of the day's steps would be recorded
          // as having contributed none of them.
          contributed:
            o.packageName === read.primaryOrigin ? o.steps : c?.contributed ?? 0,
          disjointFraction:
            o.packageName === read.primaryOrigin ? 1 : c?.disjointFraction ?? 0,
        };
      });

    return {
      reader: 'health_connect',
      method: read.method,
      primaryOrigin: read.primaryOrigin || undefined,
      origins,
      hourly: read.hourly?.length ? read.hourly : undefined,
      recordedFrom: read.recordedFrom ?? undefined,
      recordedTo: read.recordedTo ?? undefined,
      recordCount: read.recordCount,
      offlineMinutes,
    };
  }

  // ── The figure came from the phone's own sensor ──────────────────────────
  // TYPE_STEP_COUNTER is a running total with no timestamps behind it, so there
  // is no histogram and no per-app breakdown to give. Saying so explicitly is
  // the point: an empty origin list from this reader means "this source cannot
  // break down", not "nothing was found".
  if (winner === 'native_sensor') {
    return {
      reader: 'native_sensor',
      method: 'sensor',
      origins: [],
      offlineMinutes,
    };
  }

  // ── The figure came from the server's own stored value ───────────────────
  // Another device already synced it. This device is passing it back, and
  // recording that is what stops the same steps being investigated as if this
  // phone had counted them.
  if (winner === 'server') {
    return {
      reader: 'server',
      method: 'server-floor',
      origins: [],
      offlineMinutes,
    };
  }

  // ── The platform health store, with no breakdown available ──────────────
  //
  // iOS. `resolveSteps` calls its first input `healthConnect` on both platforms
  // because the two play the same role, but HealthKit exposes no per-origin
  // totals and no dedup, so there is no read detail to attach.
  //
  // Without this branch it fell through to 'unknown' and the ledger would say
  // "a build that does not report its step source" for every iOS sync — which is
  // wrong in the way that costs the most time, since it points an investigation
  // at the client version rather than at HealthKit.
  if (winner === 'health_connect') {
    return {
      reader: 'health_connect',
      method: 'platform-store',
      origins: [],
      offlineMinutes,
    };
  }

  // Nothing resolved. Still worth sending: "steps were synced and no source
  // claims them" is a finding, and an absent block is indistinguishable from an
  // old build that cannot send one.
  if (resolution) {
    return { reader: 'unknown', method: 'unresolved', origins: [], offlineMinutes };
  }

  return undefined;
}
