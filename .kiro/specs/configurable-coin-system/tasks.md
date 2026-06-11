# Implementation Plan: Configurable Coin System

## Overview

Make the step-based coin earning system fully backend-configurable by adding a `coin_config` section to the AppConfig model, exposing it via the existing GET/PATCH config endpoints with validation, modifying the client to read rates from the config store, and creating new hooks for real-time step-coin calculations and daily step goal claiming.

## Tasks

- [x] 1. Backend: Add coin_config schema and serve it in config endpoint
  - [x] 1.1 Add coin_config field to AppConfig model schema
    - Add the `coin_config` nested field to `src/models/AppConfig.model.js` with `steps.rate_per_100_steps` (Number, default 0.00095) and `rewards.daily_step_goal_reached` (object with `enabled` Boolean default true, `coin_value` Number default 50)
    - _Requirements: 2.1, 2.2, 4.1, 4.2, 9.6_

  - [x] 1.2 Include coin_config in GET /config/app response
    - Modify `getAppConfig` in `src/controllers/config.controller.js` to include `coin_config` in the response object with safe fallback defaults using optional chaining and nullish coalescing
    - Ensure existing top-level sections (coin, steps, rewards, features, maintenance, support) remain unchanged
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6_

  - [x] 1.3 Add validation for coin_config fields in PATCH /config/app
    - In `updateAppConfig` in `src/controllers/config.controller.js`, add validation before persisting: `rate_per_100_steps` must be a positive number ≤ 1.0; `coin_value` must be a non-negative integer
    - Return descriptive 400 error messages on validation failure
    - _Requirements: 2.4, 2.5, 4.4, 4.5, 8.5_

- [x] 2. Backend: Modify claimReward to use coin_config
  - [x] 2.1 Update steps_daily reward definition in claimReward
    - In `src/controllers/gamification.controller.js`, modify the `steps_daily` entry in the REWARDS map within `claimReward` to read the reward value from `cfg.coin_config?.rewards?.daily_step_goal_reached?.coin_value ?? cfg.rewards.stepGoalCoins`
    - Add an enabled check: if `cfg.coin_config?.rewards?.daily_step_goal_reached?.enabled` is false, the `isMet` function returns false
    - Add an early return with a "reward is currently disabled" error (400) if `enabled` is false and user tries to claim `steps_daily`
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 5.8_

  - [x] 2.2 Write unit tests for modified claimReward steps_daily logic
    - Test successful claim reads coin_value from coin_config
    - Test claim rejection when enabled is false
    - Test duplicate claim rejection (same calendar day)
    - Test daily cap enforcement on step goal reward
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

- [x] 3. Checkpoint - Backend changes verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Client: Extend AppConfig type and store with coin_config
  - [x] 4.1 Add coin_config to AppConfig type and defaults
    - In `src/config/appConfig.ts`, add the `coin_config` property to `APP_CONFIG_DEFAULTS` with `steps.rate_per_100_steps: 0.00095` and `rewards.daily_step_goal_reached: { enabled: true, coin_value: 50 }`
    - Add the corresponding type definition to the `AppConfig` type
    - _Requirements: 6.2, 6.3_

  - [x] 4.2 Add selectors for coin_config values in appConfigStore
    - In `src/store/appConfigStore.ts`, add `useStepCoinRate` selector (returns `config.coin_config?.steps?.rate_per_100_steps ?? 0.00095`) and `useDailyStepGoalRewardConfig` selector (returns the full `daily_step_goal_reached` object with defaults)
    - _Requirements: 6.3, 6.4_

  - [x] 4.3 Add validation for coin_config fields in appConfigService
    - In `src/services/appConfigService.ts`, after fetching config, validate that `coin_config.steps.rate_per_100_steps` and `coin_config.rewards.daily_step_goal_reached` are present and non-null; throw an error if missing so the store falls back to persisted/default config
    - _Requirements: 6.5, 9.1, 9.2_

- [x] 5. Client: Create useStepCoinEarnings hook
  - [x] 5.1 Implement useStepCoinEarnings hook
    - Create `src/features/health/hooks/useStepCoinEarnings.ts`
    - Hook reads the step coin rate from `useStepCoinRate` selector
    - Calculates earnings: `Math.round(Math.floor(steps / 100) * rate)`
    - Subscribes to step sensor updates for real-time recalculation
    - Sets up a periodic recalculation timer (≤30s interval)
    - Exposes `earnings`, `steps`, `isStale`, `lastCalcTime`
    - _Requirements: 1.1, 1.2, 1.4, 7.1, 7.2, 7.3, 7.4_

  - [x] 5.2 Write property test for step earning determinism
    - **Property 1: Step Earning Determinism**
    - For any `total_daily_steps` (non-negative integer) and `rate_per_100_steps` (positive number ≤ 1.0), the calculation `Math.round(Math.floor(steps / 100) * rate)` always produces the same result for the same inputs
    - **Validates: Requirements 1.1, 1.4**

  - [x] 5.3 Write unit tests for useStepCoinEarnings hook
    - Test calculation with various step counts (0, 99, 100, 1000, 10000)
    - Test rate changes are applied immediately
    - Test staleness detection after 30s
    - _Requirements: 1.1, 1.4, 7.2, 7.3_

- [x] 6. Client: Modify useEarnCoins to use configurable rate
  - [x] 6.1 Update useEarnCoins to read rate from config store
    - In `src/features/health/hooks/useEarnCoins.ts`, import and use `useStepCoinRate` from the appConfigStore
    - Add a `calculateStepCoins` helper: `Math.round(Math.floor(steps / 100) * rate)`
    - Ensure no hardcoded numeric literals for coin rates remain in the file
    - _Requirements: 1.2, 1.3, 6.3_

- [x] 7. Client: Create useDailyStepGoalReward hook
  - [x] 7.1 Implement useDailyStepGoalReward hook
    - Create `src/features/health/hooks/useDailyStepGoalReward.ts`
    - Import `useDailyStepGoalRewardConfig` from appConfigStore
    - Wrap the existing `gamificationService.claimReward('steps_daily')` call in a `useMutation`
    - Expose `claimReward`, `isPending`, `isEnabled`, `coinValue`
    - Invalidate relevant queries on success (`coin-data`, `gamification`)
    - _Requirements: 3.1, 3.3, 3.4_

  - [x] 7.2 Write property test for daily goal idempotency
    - **Property 2: Daily Goal Idempotency**
    - Multiple calls to claim within the same calendar day result in exactly one successful award; subsequent calls return an error without modifying the balance
    - **Validates: Requirements 3.1, 3.2**

- [x] 8. Checkpoint - Client integration verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Integration wiring and backward compatibility verification
  - [x] 9.1 Verify end-to-end config flow
    - Ensure AppConfig model → GET /config/app response → client fetch → store → hook consumption all work together
    - Verify PATCH /config/app with coin_config updates propagates to next GET response
    - _Requirements: 2.3, 4.3, 6.1, 6.4, 8.3_

  - [x] 9.2 Write property test for config continuity
    - **Property 3: Config Continuity**
    - If the config endpoint is unreachable, the client continues using last fetched config (or defaults); coin calculations never use null/undefined values
    - **Validates: Requirements 6.2, 6.5**

  - [x] 9.3 Write integration tests for backward compatibility
    - **Property 4: Backward Compatibility**
    - Config endpoint always includes all existing top-level sections (coin, steps, rewards, features, maintenance, support) with unchanged structure
    - **Property 5: Existing Source Preservation**
    - Streak bonus, login reward, and referral bonus operations produce identical results before and after this change
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 9.3**

- [x] 10. Final checkpoint - All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- No new backend routes or model fields beyond `coin_config` are needed
- The existing `PATCH /config/app` deep-merge already handles nested updates — only validation logic is added
- The existing `POST /gamification/coins/claim` with `steps_daily` rewardId is modified in-place, not replaced

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "4.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "4.2", "4.3"] },
    { "id": 2, "tasks": ["2.1", "5.1", "6.1", "7.1"] },
    { "id": 3, "tasks": ["2.2", "5.2", "5.3", "7.2"] },
    { "id": 4, "tasks": ["9.1"] },
    { "id": 5, "tasks": ["9.2", "9.3"] }
  ]
}
```
