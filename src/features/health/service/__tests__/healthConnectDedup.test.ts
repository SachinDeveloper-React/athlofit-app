/**
 * Coverage-based step deduplication across Health Connect data origins.
 *
 * The case that matters most here is the regression at the bottom: two origins
 * describing the SAME 22,000 steps used to be reported as 37,529 because a long
 * aggregate record was spread evenly across the day and won every slot the
 * granular source did not. Those phantom steps reached the server and minted
 * passive step coins, so the inflation is a money bug, not a display one.
 */

// The module under test imports the native Health Connect bindings at the top
// level. The dedup itself is pure, so the binding only needs to exist.
jest.mock('react-native-health-connect', () => ({
  initialize: jest.fn(),
  requestPermission: jest.fn(),
  readRecords: jest.fn(),
  insertRecords: jest.fn(),
  deleteRecordsByTimeRange: jest.fn(),
  getSdkStatus: jest.fn(),
  getGrantedPermissions: jest.fn(),
  SdkAvailabilityStatus: { SDK_AVAILABLE: 3 },
  BackgroundAccessPermission: {},
}));

import {
  dedupeStepsAcrossOrigins,
  type StepRecordLite,
} from '../healthConnect.service';

const DAY = new Date('2026-08-28T00:00:00.000Z').getTime();
/** Epoch ms for a local-ish hour/minute offset into the test day. */
const at = (hour: number, minute = 0) => DAY + (hour * 60 + minute) * 60_000;

const rec = (
  origin: string,
  count: number,
  startHour: number,
  endHour: number,
): StepRecordLite => ({ origin, count, start: at(startHour), end: at(endHour) });

const SAMSUNG = 'com.sec.android.app.shealth';
const FIT = 'com.google.android.apps.fitness';
const WATCH = 'com.garmin.android.apps.connectmobile';

/** The four walks the user actually took, as granular records. */
const granularWalks = (origin: string): StepRecordLite[] => [
  rec(origin, 6000, 7, 8),
  rec(origin, 5000, 12.5, 13.5),
  rec(origin, 6000, 17, 18.5),
  rec(origin, 5000, 20, 21.5),
];

describe('dedupeStepsAcrossOrigins', () => {
  it('returns the origin total unchanged when there is only one source', () => {
    const result = dedupeStepsAcrossOrigins(granularWalks(FIT));

    expect(result.steps).toBe(22_000);
    expect(result.largestOrigin).toBe(22_000);
    expect(result.primaryOrigin).toBe(FIT);
  });

  it('reports zero for no records', () => {
    const result = dedupeStepsAcrossOrigins([]);

    expect(result.steps).toBe(0);
    expect(result.primaryOrigin).toBe('');
  });

  // ── The regression ────────────────────────────────────────────────────────
  it('does not double-count a long aggregate record against a granular source', () => {
    // Samsung Health writes ONE record covering the waking day; the platform
    // sensor writes the same walks minute by minute. Same 22,000 steps, twice.
    const records: StepRecordLite[] = [
      rec(SAMSUNG, 22_000, 6, 23),
      ...granularWalks(FIT),
    ];

    const result = dedupeStepsAcrossOrigins(records);

    expect(result.steps).toBe(22_000);
    // The old implementation produced 37,529 here.
    expect(result.steps).toBeLessThan(23_000);
    expect(result.originSum).toBe(44_000);
  });

  it('is unaffected by which of two duplicate sources happens to be larger', () => {
    // Same scenario with the granular source slightly ahead, so the aggregate
    // record is no longer the primary. The flipped ordering used to inflate too.
    const records: StepRecordLite[] = [
      rec(SAMSUNG, 21_000, 6, 23),
      ...granularWalks(FIT),
    ];

    const result = dedupeStepsAcrossOrigins(records);

    expect(result.primaryOrigin).toBe(FIT);
    expect(result.steps).toBe(22_000);
  });

  it('treats an hourly-aggregate mirror as a duplicate, not extra steps', () => {
    // Samsung also writes hour-by-hour rather than one daily record on some
    // devices. Those are short enough to look granular but are still a mirror.
    const hourly: StepRecordLite[] = Array.from({ length: 17 }, (_, i) =>
      rec(SAMSUNG, Math.round(22_000 / 17), 6 + i, 7 + i),
    );

    const result = dedupeStepsAcrossOrigins([...hourly, ...granularWalks(FIT)]);

    expect(result.steps).toBeLessThanOrEqual(22_002);
  });

  it('deduplicates two granular sources recording the same walks', () => {
    const result = dedupeStepsAcrossOrigins([
      ...granularWalks(FIT),
      ...granularWalks(SAMSUNG),
    ]);

    expect(result.steps).toBe(22_000);
  });

  // ── The case max() gets wrong, which is why this is not just max() ─────────
  it('adds a second device that recorded a different part of the day', () => {
    // Phone in the morning, watch in the afternoon — no shared recording time,
    // so these are genuinely different steps.
    const records: StepRecordLite[] = [
      rec(FIT, 5_000, 7, 9),
      rec(WATCH, 6_000, 15, 18),
    ];

    const result = dedupeStepsAcrossOrigins(records);

    expect(result.steps).toBe(11_000);
    expect(result.primaryOrigin).toBe(WATCH);
  });

  it('adds only the disjoint share when two devices partially overlap', () => {
    // A watch worn all day and a phone carried for one walk inside that window:
    // the phone is a mirror for that hour, so it must not be added.
    const records: StepRecordLite[] = [
      rec(WATCH, 20_000, 6, 22),
      rec(FIT, 3_000, 12, 13),
    ];

    const result = dedupeStepsAcrossOrigins(records);

    expect(result.steps).toBe(20_000);
  });

  it('splits complementary aggregate records from two devices', () => {
    // Two apps each summarising half the day. Disjoint, so both count.
    const records: StepRecordLite[] = [
      rec(FIT, 10_000, 0, 12),
      rec(WATCH, 12_000, 12, 24),
    ];

    expect(dedupeStepsAcrossOrigins(records).steps).toBe(22_000);
  });

  it('does not let a zero-duration record claim independent coverage', () => {
    const records: StepRecordLite[] = [
      rec(SAMSUNG, 20_000, 6, 22),
      { origin: FIT, count: 9_000, start: at(12), end: at(12) },
    ];

    expect(dedupeStepsAcrossOrigins(records).steps).toBe(20_000);
  });

  it('ignores records with no steps when measuring coverage', () => {
    const records: StepRecordLite[] = [
      rec(FIT, 5_000, 7, 9),
      rec(SAMSUNG, 0, 7, 23), // empty all-day record must not claim the day
      rec(WATCH, 6_000, 15, 18),
    ];

    expect(dedupeStepsAcrossOrigins(records).steps).toBe(11_000);
  });

  it('is independent of record order', () => {
    const records: StepRecordLite[] = [
      rec(SAMSUNG, 22_000, 6, 23),
      ...granularWalks(FIT),
    ];
    const reversed = [...records].reverse();

    expect(dedupeStepsAcrossOrigins(reversed).steps).toBe(
      dedupeStepsAcrossOrigins(records).steps,
    );
  });

  it('breaks ties deterministically rather than by record order', () => {
    // Both origins report exactly 22,000 over the same window.
    const a = dedupeStepsAcrossOrigins([
      ...granularWalks(FIT),
      ...granularWalks(SAMSUNG),
    ]);
    const b = dedupeStepsAcrossOrigins([
      ...granularWalks(SAMSUNG),
      ...granularWalks(FIT),
    ]);

    expect(a.primaryOrigin).toBe(b.primaryOrigin);
    expect(a.steps).toBe(b.steps);
  });

  // ── Invariants ────────────────────────────────────────────────────────────
  it('always lands between the largest single origin and the raw sum', () => {
    const scenarios: StepRecordLite[][] = [
      [rec(SAMSUNG, 22_000, 6, 23), ...granularWalks(FIT)],
      [rec(FIT, 5_000, 7, 9), rec(WATCH, 6_000, 15, 18)],
      [rec(FIT, 10_000, 0, 12), rec(WATCH, 12_000, 12, 24)],
      [rec(WATCH, 20_000, 6, 22), rec(FIT, 3_000, 12, 13)],
      granularWalks(FIT),
    ];

    for (const records of scenarios) {
      const { steps, largestOrigin, originSum } = dedupeStepsAcrossOrigins(records);
      expect(steps).toBeGreaterThanOrEqual(largestOrigin);
      expect(steps).toBeLessThanOrEqual(originSum);
    }
  });
});

/**
 * Origin stickiness.
 *
 * "Primary" used to mean nothing but "the origin with the highest count", which
 * is a rule about size in a store any app on the phone can write to. A spoofer
 * installs under a generated package name, writes a large number of records, and
 * is handed the baseline by definition — at which point the user's real steps are
 * measured against the injected timeline, judged a mirror, and contribute zero.
 *
 * These pin the demotion AND its limits, because being wrong in the other
 * direction costs a real user their steps.
 */
describe('dedupeStepsAcrossOrigins — origin stickiness', () => {
  /** A generated package name of the shape the incident used. */
  const INJECTED = 'com.android.healthconnect.phone.j28f624b03f823dd28eb3107c2fe94f53';

  /** The injected day: one big record covering everything the user really walked. */
  const injectedDay = (count: number): StepRecordLite[] => [
    rec(INJECTED, count, 6, 22),
  ];

  it('lets a larger unestablished origin take the baseline when nothing is established', () => {
    // The old behaviour, and still correct when there is no history to reason
    // from — a first run, or a phone whose only source is genuinely new.
    const result = dedupeStepsAcrossOrigins([
      ...granularWalks(FIT),
      ...injectedDay(45_000),
    ]);

    expect(result.primaryOrigin).toBe(INJECTED);
    expect(result.primaryTotal).toBe(45_000);
  });

  it('keeps the established origin as the baseline against a larger newcomer', () => {
    // The fix. Google Fit recorded 22,000 across four walks; the injected origin
    // claims 45,000 across one record covering the same hours.
    const result = dedupeStepsAcrossOrigins(
      [...granularWalks(FIT), ...injectedDay(45_000)],
      new Set([FIT]),
    );

    expect(result.primaryOrigin).toBe(FIT);
    expect(result.primaryTotal).toBe(22_000);
  });

  it('does not let the demoted origin back in as a floor', () => {
    // `steps` is built on the primary's total. Using `largestOrigin` here would
    // hand the injected count straight back and undo the demotion entirely.
    const result = dedupeStepsAcrossOrigins(
      [...granularWalks(FIT), ...injectedDay(45_000)],
      new Set([FIT]),
    );

    expect(result.largestOrigin).toBe(45_000); // still reported, for diagnosis
    expect(result.steps).toBe(22_000);
    expect(result.steps).toBeLessThan(result.largestOrigin);
  });

  it('discards the injected origin entirely when it mirrors the real one', () => {
    const result = dedupeStepsAcrossOrigins(
      [...granularWalks(FIT), ...injectedDay(45_000)],
      new Set([FIT]),
    );

    const injected = result.contributions.find(c => c.packageName === INJECTED);
    expect(injected?.contributed).toBe(0);
  });

  it('still counts a genuine second device that recorded different hours', () => {
    // The limit of the demotion. A watch that recorded a period the phone did not
    // is not a mirror, and losing its steps would be the expensive mistake.
    const result = dedupeStepsAcrossOrigins(
      [...granularWalks(FIT), rec(WATCH, 3_000, 2, 4)],
      new Set([FIT]),
    );

    const watch = result.contributions.find(c => c.packageName === WATCH);
    expect(watch?.contributed).toBe(3_000);
    expect(result.steps).toBe(25_000);
  });

  it('falls back to size when the established origin is not present today', () => {
    // Someone who switched fitness apps outright. The old source is gone from the
    // data, so there is nothing to be sticky about and the new one is the answer.
    const result = dedupeStepsAcrossOrigins(
      granularWalks(SAMSUNG),
      new Set([FIT]),
    );

    expect(result.primaryOrigin).toBe(SAMSUNG);
    expect(result.steps).toBe(22_000);
  });

  it('prefers the largest among established origins, not merely any of them', () => {
    // Stickiness picks a baseline from the trusted set; it does not abandon the
    // size rule inside it.
    const result = dedupeStepsAcrossOrigins(
      [...granularWalks(FIT), rec(SAMSUNG, 500, 7, 8), ...injectedDay(45_000)],
      new Set([FIT, SAMSUNG]),
    );

    expect(result.primaryOrigin).toBe(FIT);
    expect(result.primaryTotal).toBe(22_000);
  });

  it('is unchanged from the old behaviour when no set is passed', () => {
    const withoutSet = dedupeStepsAcrossOrigins([
      ...granularWalks(FIT),
      ...injectedDay(45_000),
    ]);
    const withEmptySet = dedupeStepsAcrossOrigins(
      [...granularWalks(FIT), ...injectedDay(45_000)],
      new Set(),
    );

    expect(withoutSet).toEqual(withEmptySet);
  });
});
