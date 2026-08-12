// Tests for the step resolution engine.
//
// These lock in the properties that the old pipeline violated. Each block names
// the failure it prevents, because the symptoms were numeric and easy to
// reintroduce by "helpfully" adding a floor or an addition somewhere.

import {
  resolveSteps,
  detectServerEcho,
  minutesSinceLocalMidnight,
  MAX_PLAUSIBLE_DAILY_STEPS,
  type ResolveStepsInput,
} from '../stepEngine';
import { getLocalToday } from '../../../../utils/date';

/** Mid-afternoon, so the elapsed-time bound is not the thing under test. */
const AFTERNOON_MINUTES = 15 * 60;

function input(overrides: Partial<ResolveStepsInput> = {}): ResolveStepsInput {
  return {
    healthConnect: { steps: 0, available: false },
    nativeSensor: { steps: 0, available: false },
    server: { steps: 0, available: false, isEcho: null },
    bonusSteps: 0,
    minutesElapsedToday: AFTERNOON_MINUTES,
    ...overrides,
  };
}

describe('resolveSteps — the reported bug', () => {
  // The device showed 7,097 while Health Connect reported 1,720 and the phone
  // sensor 571. The 7,097 came from a persisted value that had been ratcheted up
  // and synced to the server, then read back as a baseline.
  it('rejects a server value that towers over every local source', () => {
    const result = resolveSteps(
      input({
        healthConnect: { steps: 1720, available: true },
        nativeSensor: { steps: 571, available: true },
        server: { steps: 7097, available: true, isEcho: null },
      }),
    );

    expect(result.deviceSteps).toBe(1720);
    expect(result.winner).toBe('health_connect');
    expect(result.rejected.map(r => r.id)).toContain('server');
    expect(result.rejected.find(r => r.id === 'server')?.reason).toMatch(/higher than every local source/);
  });

  it('never produces a total larger than its largest input', () => {
    const result = resolveSteps(
      input({
        healthConnect: { steps: 1720, available: true },
        nativeSensor: { steps: 571, available: true },
        server: { steps: 1500, available: true, isEcho: false },
      }),
    );

    // The old pipeline could reach 1720 + 571 + 1500 through its additive paths.
    expect(result.deviceSteps).toBe(1720);
    expect(result.deviceSteps).toBeLessThanOrEqual(1720);
  });
});

describe('resolveSteps — purity', () => {
  // The monotonic floor meant the same readings could produce different results
  // depending on what had been displayed earlier. Nothing may carry over.
  it('returns the same result for the same input, however many times it runs', () => {
    const args = input({
      healthConnect: { steps: 4200, available: true },
      nativeSensor: { steps: 4100, available: true },
    });

    const first = resolveSteps(args);
    const second = resolveSteps(args);
    const third = resolveSteps(args);

    expect(second.deviceSteps).toBe(first.deviceSteps);
    expect(third.deviceSteps).toBe(first.deviceSteps);
  });

  it('follows a source downward instead of holding the previous high', () => {
    const high = resolveSteps(input({ healthConnect: { steps: 9000, available: true } }));
    const low = resolveSteps(input({ healthConnect: { steps: 3000, available: true } }));

    expect(high.deviceSteps).toBe(9000);
    expect(low.deviceSteps).toBe(3000);
  });
});

describe('resolveSteps — source trust', () => {
  it('accepts Health Connect far above the phone sensor (paired watch)', () => {
    // A watch contributes steps this phone never saw, so this is legitimate and
    // must not be treated as inflation.
    const result = resolveSteps(
      input({
        healthConnect: { steps: 12000, available: true },
        nativeSensor: { steps: 3000, available: true },
      }),
    );

    expect(result.deviceSteps).toBe(12000);
    expect(result.winner).toBe('health_connect');
    expect(result.rejected.map(r => r.id)).not.toContain('health_connect');
  });

  it('rejects a phone sensor running far ahead of Health Connect (drifted counter)', () => {
    // Health Connect contains the platform pedometer's own records, so the sensor
    // cannot genuinely be multiples ahead of it.
    const result = resolveSteps(
      input({
        healthConnect: { steps: 2000, available: true },
        nativeSensor: { steps: 9000, available: true },
      }),
    );

    expect(result.deviceSteps).toBe(2000);
    expect(result.rejected.find(r => r.id === 'native_sensor')?.reason).toMatch(/drifted/);
  });

  it('trusts the phone sensor when Health Connect has too little to judge by', () => {
    // Some devices never write to Health Connect. A near-empty HC reading must not
    // veto a working sensor.
    const result = resolveSteps(
      input({
        healthConnect: { steps: 120, available: true },
        nativeSensor: { steps: 6000, available: true },
      }),
    );

    expect(result.deviceSteps).toBe(6000);
    expect(result.winner).toBe('native_sensor');
  });

  it('ignores an unavailable source rather than reading it as zero', () => {
    const result = resolveSteps(
      input({
        healthConnect: { steps: 0, available: false },
        nativeSensor: { steps: 5000, available: true },
      }),
    );

    expect(result.deviceSteps).toBe(5000);
  });

  it('resolves to 0 when nothing is usable', () => {
    const result = resolveSteps(input());
    expect(result.deviceSteps).toBe(0);
    expect(result.winner).toBe('none');
    expect(result.explanation).toMatch(/No usable source/);
  });
});

describe('resolveSteps — the server floor', () => {
  it("ignores the server when it is this device's own value coming back", () => {
    const result = resolveSteps(
      input({
        healthConnect: { steps: 3000, available: true },
        server: { steps: 3000, available: true, isEcho: true },
      }),
    );

    expect(result.deviceSteps).toBe(3000);
    expect(result.rejected.find(r => r.id === 'server')?.reason).toMatch(/Echo/);
  });

  it('uses the server as a floor when another device contributed', () => {
    // Reinstall or second phone: local sources only know this device's steps.
    const result = resolveSteps(
      input({
        healthConnect: { steps: 400, available: true },
        nativeSensor: { steps: 400, available: true },
        server: { steps: 8000, available: true, isEcho: false },
      }),
    );

    expect(result.deviceSteps).toBe(8000);
    expect(result.winner).toBe('server');
  });

  it('trusts a much larger server value when local readings are still small', () => {
    // Below the cross-check threshold there is no way to tell a genuine
    // cross-device carry-over from inflation, so the user gets the benefit.
    const result = resolveSteps(
      input({
        healthConnect: { steps: 300, available: true },
        server: { steps: 8000, available: true, isEcho: null },
      }),
    );

    expect(result.deviceSteps).toBe(8000);
  });
});

describe('resolveSteps — plausibility limits', () => {
  it('rejects anything past the absolute daily ceiling', () => {
    const result = resolveSteps(
      input({
        healthConnect: { steps: MAX_PLAUSIBLE_DAILY_STEPS + 1, available: true },
        nativeSensor: { steps: 5000, available: true },
      }),
    );

    expect(result.deviceSteps).toBe(5000);
    expect(result.rejected.find(r => r.id === 'health_connect')?.reason).toMatch(/absolute daily limit/);
  });

  it("rejects a full day's total in the first minutes after midnight", () => {
    // This is the guard against yesterday's count bleeding into the new day.
    const result = resolveSteps(
      input({
        healthConnect: { steps: 12000, available: true },
        minutesElapsedToday: 5,
      }),
    );

    expect(result.deviceSteps).toBe(0);
    expect(result.rejected.find(r => r.id === 'health_connect')?.reason).toMatch(/Impossible for the time of day/);
  });

  it('allows a plausible count for the time elapsed', () => {
    const result = resolveSteps(
      input({
        healthConnect: { steps: 800, available: true },
        minutesElapsedToday: 60,
      }),
    );

    expect(result.deviceSteps).toBe(800);
  });
});

describe('resolveSteps — bonus steps', () => {
  it('adds bonus to the displayed total but never to the device total', () => {
    // deviceSteps is what gets synced. Including bonus there would make the server
    // add it a second time.
    const result = resolveSteps(
      input({
        healthConnect: { steps: 5000, available: true },
        bonusSteps: 1500,
      }),
    );

    expect(result.deviceSteps).toBe(5000);
    expect(result.bonusSteps).toBe(1500);
    expect(result.displaySteps).toBe(6500);
  });
});

describe('resolveSteps — malformed readings', () => {
  it.each([
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['a negative count', -500],
    ['the native "service not running" sentinel', -1],
  ])('treats %s as no data', (_label, steps) => {
    const result = resolveSteps(
      input({
        healthConnect: { steps: steps as number, available: true },
        nativeSensor: { steps: 2000, available: true },
      }),
    );

    expect(result.deviceSteps).toBe(2000);
    expect(Number.isFinite(result.displaySteps)).toBe(true);
  });
});

describe('detectServerEcho', () => {
  it('reports unknown when nothing was pushed today', () => {
    expect(detectServerEcho(5000, 0, null)).toBeNull();
    expect(detectServerEcho(5000, 4000, '1999-01-01')).toBeNull();
  });

  it('treats a value at or below our own last push as an echo', () => {
    const today = getLocalToday();
    expect(detectServerEcho(4000, 4000, today)).toBe(true);
    expect(detectServerEcho(3900, 4000, today)).toBe(true);
  });

  it('treats a clearly higher value as a genuine contribution', () => {
    expect(detectServerEcho(6000, 4000, getLocalToday())).toBe(false);
  });
});

describe('minutesSinceLocalMidnight', () => {
  it('grows through the day and stays within a day', () => {
    const morning = minutesSinceLocalMidnight(new Date(2026, 0, 15, 6, 0, 0));
    const evening = minutesSinceLocalMidnight(new Date(2026, 0, 15, 22, 0, 0));

    expect(morning).toBeLessThan(evening);
    expect(evening).toBeLessThanOrEqual(24 * 60 + 1);
    expect(minutesSinceLocalMidnight(new Date(2026, 0, 15, 0, 0, 0))).toBeGreaterThan(0);
  });
});

describe('live projection between batch reads', () => {
  // Mirrors what useHealth.onStepUpdate computes. Health Connect is up to 90s
  // stale, so the sensor's increment since the batch read is added to bring it up
  // to date. The property that matters is that this does NOT compound: the anchor
  // is fixed between refreshes, so walking 100 steps reads +100 no matter how many
  // sensor events arrive.
  const project = (hcAtRead: number, nativeAtRead: number, nativeNow: number) =>
    resolveSteps(
      input({
        healthConnect: {
          steps: hcAtRead + Math.max(0, nativeNow - nativeAtRead),
          available: true,
        },
        nativeSensor: { steps: nativeNow, available: true },
      }),
    ).deviceSteps;

  it('advances the total as the sensor advances', () => {
    expect(project(5000, 4800, 4800)).toBe(5000);
    expect(project(5000, 4800, 4850)).toBe(5050);
    expect(project(5000, 4800, 4900)).toBe(5100);
  });

  it('does not compound across repeated events', () => {
    // Ten events arriving while the user walks 100 steps must total +100, not +1000.
    let last = 0;
    for (let walked = 10; walked <= 100; walked += 10) {
      last = project(5000, 4800, 4800 + walked);
    }
    expect(last).toBe(5100);
  });

  it('holds steady when the sensor service restarts and reports lower', () => {
    // Increment floors at 0, so a restarted counter cannot subtract from the day.
    expect(project(5000, 4800, 30)).toBe(5000);
  });

  it('falls back to the raw sensor count when there is no batch reading', () => {
    const result = resolveSteps(
      input({
        healthConnect: { steps: 0, available: false },
        nativeSensor: { steps: 3200, available: true },
      }),
    );
    expect(result.deviceSteps).toBe(3200);
  });
});
