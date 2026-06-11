/**
 * Property-Based Test: Config Continuity
 *
 * **Validates: Requirements 6.2, 6.5**
 *
 * If the config endpoint is unreachable, the client continues using last fetched
 * config (or defaults); coin calculations never use null/undefined values.
 *
 * Tests the invariant that regardless of any sequence of successful/failed config
 * fetches, the store and selectors always provide valid, non-null values for coin
 * calculations.
 */
import * as fc from 'fast-check';
import { APP_CONFIG_DEFAULTS, type AppConfig } from '../../../../config/appConfig';

// ─── Pure logic extracted from the store and selectors ───────────────────────

/**
 * Simulates the store's config resolution after a sequence of fetch attempts.
 * Mirrors the behavior of useAppConfigStore: persists last successful config,
 * falls back to defaults if no successful fetch has occurred.
 */
function resolveConfig(
  fetchResults: Array<{ success: boolean; config?: AppConfig }>,
): AppConfig {
  let currentConfig: AppConfig = { ...APP_CONFIG_DEFAULTS } as unknown as AppConfig;
  for (const result of fetchResults) {
    if (result.success && result.config != null) {
      currentConfig = result.config;
    }
    // On failure, retain the last valid config (no mutation)
  }
  return currentConfig;
}

/**
 * Mirrors the useStepCoinRate selector logic:
 * Uses optional chaining with nullish coalescing to guarantee a number.
 */
function selectStepCoinRate(config: AppConfig): number {
  return config.coin_config?.steps?.rate_per_100_steps ?? 0.00095;
}

/**
 * Mirrors the useDailyStepGoalRewardConfig selector logic:
 * Uses optional chaining with nullish coalescing to guarantee a valid object.
 */
function selectDailyStepGoalRewardConfig(config: AppConfig): {
  enabled: boolean;
  coin_value: number;
} {
  return (
    config.coin_config?.rewards?.daily_step_goal_reached ?? {
      enabled: true,
      coin_value: 50,
    }
  );
}

/**
 * The step coin calculation formula from the design document.
 */
function calculateStepCoins(steps: number, rate: number): number {
  return Math.round(Math.floor(steps / 100) * rate);
}

// ─── Generators ──────────────────────────────────────────────────────────────

/**
 * Generates a valid AppConfig with coin_config values in the expected ranges.
 */
const validAppConfigArb: fc.Arbitrary<AppConfig> = fc.record({
  coin: fc.constant(APP_CONFIG_DEFAULTS.coin),
  steps: fc.constant(APP_CONFIG_DEFAULTS.steps),
  rewards: fc.constant(APP_CONFIG_DEFAULTS.rewards),
  features: fc.constant(APP_CONFIG_DEFAULTS.features),
  maintenance: fc.constant(APP_CONFIG_DEFAULTS.maintenance),
  support: fc.constant(APP_CONFIG_DEFAULTS.support),
  coin_config: fc.record({
    steps: fc.record({
      rate_per_100_steps: fc.double({ min: 0.00001, max: 1.0, noNaN: true, noDefaultInfinity: true }),
    }),
    rewards: fc.record({
      daily_step_goal_reached: fc.record({
        enabled: fc.boolean(),
        coin_value: fc.integer({ min: 0, max: 10000 }),
      }),
    }),
  }),
}) as unknown as fc.Arbitrary<AppConfig>;

/**
 * Generates a potentially corrupted AppConfig (with missing or null coin_config fields)
 * that simulates what the service would reject via validation.
 * These represent configs that would cause fetchConfig to throw, thus never
 * reaching the store — but we test the selector fallbacks defensively.
 */
const corruptedAppConfigArb: fc.Arbitrary<Partial<AppConfig>> = fc.oneof(
  // coin_config completely missing
  fc.record({
    coin: fc.constant(APP_CONFIG_DEFAULTS.coin),
    steps: fc.constant(APP_CONFIG_DEFAULTS.steps),
    rewards: fc.constant(APP_CONFIG_DEFAULTS.rewards),
    features: fc.constant(APP_CONFIG_DEFAULTS.features),
    maintenance: fc.constant(APP_CONFIG_DEFAULTS.maintenance),
    support: fc.constant(APP_CONFIG_DEFAULTS.support),
  }),
  // coin_config.steps missing
  fc.record({
    coin: fc.constant(APP_CONFIG_DEFAULTS.coin),
    steps: fc.constant(APP_CONFIG_DEFAULTS.steps),
    rewards: fc.constant(APP_CONFIG_DEFAULTS.rewards),
    features: fc.constant(APP_CONFIG_DEFAULTS.features),
    maintenance: fc.constant(APP_CONFIG_DEFAULTS.maintenance),
    support: fc.constant(APP_CONFIG_DEFAULTS.support),
    coin_config: fc.record({
      steps: fc.constant(undefined as any),
      rewards: fc.record({
        daily_step_goal_reached: fc.record({
          enabled: fc.boolean(),
          coin_value: fc.integer({ min: 0, max: 10000 }),
        }),
      }),
    }),
  }),
  // coin_config.rewards.daily_step_goal_reached missing
  fc.record({
    coin: fc.constant(APP_CONFIG_DEFAULTS.coin),
    steps: fc.constant(APP_CONFIG_DEFAULTS.steps),
    rewards: fc.constant(APP_CONFIG_DEFAULTS.rewards),
    features: fc.constant(APP_CONFIG_DEFAULTS.features),
    maintenance: fc.constant(APP_CONFIG_DEFAULTS.maintenance),
    support: fc.constant(APP_CONFIG_DEFAULTS.support),
    coin_config: fc.record({
      steps: fc.record({
        rate_per_100_steps: fc.double({ min: 0.00001, max: 1.0, noNaN: true, noDefaultInfinity: true }),
      }),
      rewards: fc.constant(undefined as any),
    }),
  }),
);

/**
 * Generates a sequence of fetch results — a mix of successes and failures.
 */
const fetchSequenceArb: fc.Arbitrary<Array<{ success: boolean; config?: AppConfig }>> =
  fc.array(
    fc.oneof(
      // Successful fetch with valid config
      validAppConfigArb.map(config => ({ success: true, config })),
      // Failed fetch (network error, timeout, validation failure)
      fc.constant({ success: false, config: undefined }),
    ),
    { minLength: 1, maxLength: 20 },
  );

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 3: Config Continuity', () => {
  /**
   * **Validates: Requirements 6.2, 6.5**
   *
   * For any sequence of config fetch attempts (some succeed, some fail),
   * the resolved config always contains valid non-null coin_config values.
   */
  it('store always contains valid non-null config after any fetch sequence', () => {
    fc.assert(
      fc.property(fetchSequenceArb, (fetchResults) => {
        const resolvedConfig = resolveConfig(fetchResults);

        // coin_config must never be null or undefined
        expect(resolvedConfig.coin_config).toBeDefined();
        expect(resolvedConfig.coin_config).not.toBeNull();

        // steps.rate_per_100_steps must be a valid number
        expect(resolvedConfig.coin_config.steps).toBeDefined();
        expect(resolvedConfig.coin_config.steps.rate_per_100_steps).toBeDefined();
        expect(typeof resolvedConfig.coin_config.steps.rate_per_100_steps).toBe('number');
        expect(Number.isNaN(resolvedConfig.coin_config.steps.rate_per_100_steps)).toBe(false);

        // rewards.daily_step_goal_reached must be a valid object
        expect(resolvedConfig.coin_config.rewards).toBeDefined();
        expect(resolvedConfig.coin_config.rewards.daily_step_goal_reached).toBeDefined();
        expect(typeof resolvedConfig.coin_config.rewards.daily_step_goal_reached.enabled).toBe('boolean');
        expect(typeof resolvedConfig.coin_config.rewards.daily_step_goal_reached.coin_value).toBe('number');
      }),
      { numRuns: 500 },
    );
  });

  /**
   * **Validates: Requirements 6.2, 6.5**
   *
   * After a failed fetch, selectors still return valid numbers/objects
   * (never null/undefined). Tests that the ?? fallback in selectors works
   * even if the config object has missing paths.
   */
  it('selectors return valid fallback values even with corrupted config objects', () => {
    fc.assert(
      fc.property(corruptedAppConfigArb, (partialConfig) => {
        // Treat the corrupted config as if it somehow got into the store
        // (defensive check on selector logic)
        const rate = selectStepCoinRate(partialConfig as AppConfig);
        const rewardConfig = selectDailyStepGoalRewardConfig(partialConfig as AppConfig);

        // Rate must be a valid positive number
        expect(rate).toBeDefined();
        expect(rate).not.toBeNull();
        expect(typeof rate).toBe('number');
        expect(Number.isNaN(rate)).toBe(false);
        expect(rate).toBeGreaterThan(0);

        // Reward config must be a valid object with correct types
        expect(rewardConfig).toBeDefined();
        expect(rewardConfig).not.toBeNull();
        expect(typeof rewardConfig.enabled).toBe('boolean');
        expect(typeof rewardConfig.coin_value).toBe('number');
        expect(Number.isNaN(rewardConfig.coin_value)).toBe(false);
        expect(rewardConfig.coin_value).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 500 },
    );
  });

  /**
   * **Validates: Requirements 6.2, 6.5**
   *
   * The calculation `Math.round(Math.floor(steps / 100) * rate)` never produces
   * NaN when using the rate from the store's resolved config, regardless of
   * the fetch history.
   */
  it('step coin calculation never produces NaN using store rate after any fetch sequence', () => {
    fc.assert(
      fc.property(
        fetchSequenceArb,
        fc.integer({ min: 0, max: 100_000 }), // arbitrary step count
        (fetchResults, steps) => {
          const resolvedConfig = resolveConfig(fetchResults);
          const rate = selectStepCoinRate(resolvedConfig);
          const earnings = calculateStepCoins(steps, rate);

          // Must never be NaN
          expect(Number.isNaN(earnings)).toBe(false);
          // Must always be a finite integer
          expect(Number.isFinite(earnings)).toBe(true);
          expect(Number.isInteger(earnings)).toBe(true);
          // Must be non-negative (rate > 0, steps >= 0)
          expect(earnings).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 1000 },
    );
  });

  /**
   * **Validates: Requirements 6.2, 6.5**
   *
   * When ALL fetches fail (endpoint completely unreachable), the store
   * falls back to built-in defaults and selectors return default values.
   */
  it('all-failures scenario uses built-in defaults', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }), // number of failed fetches
        (failCount) => {
          const allFailures = Array.from({ length: failCount }, () => ({
            success: false,
            config: undefined,
          }));
          const resolvedConfig = resolveConfig(allFailures);

          // Should fall back to APP_CONFIG_DEFAULTS
          const rate = selectStepCoinRate(resolvedConfig);
          const rewardConfig = selectDailyStepGoalRewardConfig(resolvedConfig);

          expect(rate).toBe(0.00095);
          expect(rewardConfig).toEqual({ enabled: true, coin_value: 50 });
        },
      ),
      { numRuns: 100 },
    );
  });
});
