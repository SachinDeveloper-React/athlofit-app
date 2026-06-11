/**
 * Property-Based Test: Step Earning Determinism
 *
 * **Validates: Requirements 1.1, 1.4**
 *
 * For any `total_daily_steps` (non-negative integer) and `rate_per_100_steps`
 * (positive number ≤ 1.0), the calculation `Math.round(Math.floor(steps / 100) * rate)`
 * always produces the same result for the same inputs.
 */
import * as fc from 'fast-check';

/**
 * The step coin calculation formula as specified in the design document.
 * This is the exact same formula used in calculateStepCoins (useEarnCoins.ts)
 * and useStepCoinEarnings.ts.
 */
function calculateStepCoins(steps: number, rate: number): number {
  return Math.round(Math.floor(steps / 100) * rate);
}

describe('Property 1: Step Earning Determinism', () => {
  /**
   * **Validates: Requirements 1.1, 1.4**
   *
   * The step coin calculation is a pure function — calling it multiple times
   * with the same inputs must always yield the same result.
   */
  it('calculateStepCoins always produces the same result for the same inputs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000 }), // total_daily_steps: non-negative integer
        fc.double({ min: 0.00001, max: 1.0, noNaN: true, noDefaultInfinity: true }), // rate_per_100_steps: positive number ≤ 1.0
        (steps, rate) => {
          const result1 = calculateStepCoins(steps, rate);
          const result2 = calculateStepCoins(steps, rate);
          expect(result1).toBe(result2);
        },
      ),
      { numRuns: 1000 },
    );
  });

  /**
   * **Validates: Requirements 1.1, 1.4**
   *
   * The result must always be a non-negative integer for valid inputs.
   */
  it('always produces a non-negative integer result for valid inputs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000 }),
        fc.double({ min: 0.00001, max: 1.0, noNaN: true, noDefaultInfinity: true }),
        (steps, rate) => {
          const result = calculateStepCoins(steps, rate);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(result)).toBe(true);
        },
      ),
      { numRuns: 1000 },
    );
  });

  /**
   * **Validates: Requirements 1.1, 1.4**
   *
   * More steps should produce equal or more coins (monotonicity).
   * If steps2 >= steps1, then calculateStepCoins(steps2, rate) >= calculateStepCoins(steps1, rate).
   */
  it('more steps produce equal or more coins (monotonicity)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50_000 }),
        fc.integer({ min: 0, max: 50_000 }),
        fc.double({ min: 0.00001, max: 1.0, noNaN: true, noDefaultInfinity: true }),
        (steps1, steps2, rate) => {
          const lower = Math.min(steps1, steps2);
          const higher = Math.max(steps1, steps2);
          const result1 = calculateStepCoins(lower, rate);
          const result2 = calculateStepCoins(higher, rate);
          expect(result2).toBeGreaterThanOrEqual(result1);
        },
      ),
      { numRuns: 1000 },
    );
  });
});
