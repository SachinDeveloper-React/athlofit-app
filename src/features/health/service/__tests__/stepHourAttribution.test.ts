/**
 * Attributing steps to the hours they were RECORDED in.
 *
 * This is the field that separates the two explanations of a large jump, which
 * are indistinguishable in a daily total:
 *
 *   * 17,000 steps spread across 06:00–21:00 — a day's walking, delivered in one
 *     sync because the phone was offline. Real.
 *   * 17,000 steps inside a single fifteen-minute record — a counting bug, or an
 *     app writing a bulk entry. Not real.
 *
 * The arithmetic below is what makes the first case look like the first case,
 * so it is worth pinning directly.
 */

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
  bucketStepsByHour,
  type StepRecordLite,
} from '../healthConnect.service';

const DAY = new Date('2026-08-28T00:00:00.000Z').getTime();
const HOUR = 60 * 60 * 1000;
const at = (h: number, m = 0) => DAY + h * HOUR + m * 60 * 1000;

const record = (
  startHour: number,
  endHour: number,
  count: number,
  origin = 'com.sec.android.app.shealth',
): StepRecordLite => ({
  origin,
  count,
  start: at(startHour),
  end: at(endHour),
});

describe('bucketStepsByHour', () => {
  it('puts a record contained in one hour into that hour', () => {
    const hours = bucketStepsByHour([record(9, 10, 600)], DAY);
    expect(hours[9]).toBe(600);
    expect(hours.reduce((a, b) => a + b, 0)).toBe(600);
  });

  // ── The reason this is not a simple "which hour did it start in" ──────────
  it('splits a record across the hours it spans, in proportion', () => {
    // A record is a COUNT OVER A SPAN. Crediting all 400 to 08:00 because that
    // is where it starts would make a long bulk record collapse into one hour —
    // exactly the shape it needs to be distinguished FROM.
    const hours = bucketStepsByHour(
      [{ origin: 'x', count: 400, start: at(8, 40), end: at(9, 20) }],
      DAY,
    );

    expect(hours[8]).toBe(200);
    expect(hours[9]).toBe(200);
  });

  it('spreads an all-day bulk record over the whole day', () => {
    // The signature of a source that writes one aggregate row rather than
    // granular ones. It must not read as a burst.
    const hours = bucketStepsByHour([record(0, 24, 24_000)], DAY);

    expect(hours.filter(h => h > 0)).toHaveLength(24);
    expect(hours[3]).toBe(1000);
    expect(hours[17]).toBe(1000);
  });

  it('preserves the total across a realistic day', () => {
    // The histogram is only an explanation of the day's figure if it adds up to
    // roughly that figure. Rounding per hour means "roughly", not "exactly".
    const records = [
      record(6, 7, 1200),
      record(8, 9, 3400),
      { origin: 'x', count: 5000, start: at(12, 15), end: at(14, 45) },
      record(18, 20, 7640),
    ];

    const total = bucketStepsByHour(records, DAY).reduce((a, b) => a + b, 0);
    expect(Math.abs(total - 17_240)).toBeLessThanOrEqual(4);
  });

  it('credits an instantaneous record to the hour it sits in', () => {
    // Some writers log zero-length records. Dividing by a zero span would drop
    // them, silently losing steps the day's total still contains.
    const hours = bucketStepsByHour(
      [{ origin: 'x', count: 250, start: at(14, 30), end: at(14, 30) }],
      DAY,
    );
    expect(hours[14]).toBe(250);
  });

  it('clips a record that runs past midnight to this day', () => {
    // Health Connect returns records that merely overlap the window, so a walk
    // ending at 00:30 tomorrow reaches this function. Its hours must not spill
    // outside the 24 slots and cannot be attributed to a day this histogram is
    // not describing.
    const hours = bucketStepsByHour(
      [{ origin: 'x', count: 600, start: at(23), end: at(25) }],
      DAY,
    );

    expect(hours).toHaveLength(24);
    expect(hours[23]).toBe(300);
    expect(hours.reduce((a, b) => a + b, 0)).toBe(300);
  });

  it('ignores records with no steps', () => {
    // An empty all-day row is not evidence that anything was walked, and letting
    // it through would spread zeroes over hours that had no activity.
    const hours = bucketStepsByHour([record(0, 24, 0)], DAY);
    expect(hours.every(h => h === 0)).toBe(true);
  });

  it('sums overlapping records from the origins it is given', () => {
    // Callers pass only the origins that were COUNTED, so overlap here means a
    // phone and an independent watch — genuinely additive. Filtering mirrors is
    // the caller's job, and this deliberately does not second-guess it.
    const hours = bucketStepsByHour(
      [record(9, 10, 500, 'phone'), record(9, 10, 300, 'watch')],
      DAY,
    );
    expect(hours[9]).toBe(800);
  });
});
