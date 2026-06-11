# Requirements Document

## Introduction

Redesign the Athlofit coin earning system to be fully backend-configurable with exactly four coin sources: the existing Challenge Completed and Hydration Goal Reached mechanisms (untouched), a redesigned per-100-steps base earning calculated from a backend-configurable rate, and a new Daily Step Goal Reached one-time reward with a backend-configurable payout. All other coin sources (ad rewards, and miscellaneous earnings) are removed. The backend exposes a coin configuration endpoint, and the client fetches this config on launch with safe fallback defaults.

## Glossary

- **Coin_System**: The subsystem within Athlofit responsible for calculating, awarding, and tracking virtual coin earnings for users
- **Backend_Config_Service**: The Node.js API service that stores and serves coin configuration values from MongoDB via the AppConfig model
- **Client_App**: The Athlofit React Native mobile application that consumes configuration and calculates coin earnings locally
- **Admin_Dashboard**: The administrative interface (existing admin endpoints) that allows operators to modify coin configuration values at runtime
- **Step_Rate**: The configurable value representing coins earned per 100 steps walked, stored at `coin_config.steps.rate_per_100_steps`
- **Daily_Step_Goal_Reward**: A one-time coin payout granted when a user reaches their daily step target, with the value stored at `coin_config.rewards.daily_step_goal_reached.coin_value`
- **Challenge_Reward**: The existing coin payout granted upon completing a challenge (not modified by this feature)
- **Hydration_Reward**: The existing coin payout granted upon reaching the daily hydration goal (not modified by this feature)
- **Config_Endpoint**: The GET /config/app API endpoint that serves the coin configuration JSON to the Client_App
- **Sync_Interval**: The periodic time interval at which the Client_App recalculates step-based coin earnings from the latest step count

## Requirements

### Requirement 1: Per-100-Steps Base Earning Calculation

**User Story:** As a user, I want to earn coins continuously as I walk based on my total steps, so that I am rewarded proportionally for every 100 steps I take.

#### Acceptance Criteria

1. WHEN a user's step count is updated, THE Coin_System SHALL calculate step-based earnings using the formula: `floor(total_daily_steps / 100) × Step_Rate`, where `total_daily_steps` is the cumulative step count since the most recent local-midnight reset on the user's device
2. THE Coin_System SHALL use the Step_Rate value fetched from the Backend_Config_Service for all per-100-steps calculations
3. WHEN the Step_Rate value changes on the backend, THE Client_App SHALL apply the new rate on the next config fetch without requiring an app update
4. THE Coin_System SHALL round the result of `floor(total_daily_steps / 100) × Step_Rate` to the nearest integer (half-up) before crediting the user
5. IF the user's total_daily_steps changes due to a sensor correction (increase or decrease), THEN THE Coin_System SHALL recalculate step-based earnings using the corrected step count and update the credited amount accordingly

### Requirement 2: Backend Configuration for Step Rate

**User Story:** As an admin, I want to adjust the step earning rate from the backend, so that I can run promotional campaigns or tune the economy without deploying app updates.

#### Acceptance Criteria

1. THE Backend_Config_Service SHALL store the Step_Rate at the path `coin_config.steps.rate_per_100_steps` in the AppConfig document
2. THE Backend_Config_Service SHALL default the Step_Rate to 0.00095 coins per 100 steps when no value has been explicitly configured
3. WHEN an admin updates the Step_Rate via the Admin_Dashboard, THE Backend_Config_Service SHALL persist the new value and serve it on the next Config_Endpoint request received after persistence completes
4. THE Backend_Config_Service SHALL validate that the Step_Rate is a positive number no greater than 1.0 coins per 100 steps and containing at most 5 decimal places before persisting an update
5. IF a Step_Rate update fails validation, THEN THE Backend_Config_Service SHALL reject the request, return an error response indicating the validation failure reason, and leave the previously stored Step_Rate unchanged

### Requirement 3: Daily Step Goal Reached Reward

**User Story:** As a user, I want to receive a one-time coin bonus when I hit my daily step goal, so that I am motivated to reach my target each day.

#### Acceptance Criteria

1. WHEN a user's daily step count reaches or exceeds the user's daily step goal, THE Coin_System SHALL award the coin value specified in `coin_config.rewards.daily_step_goal_reached.coin_value` exactly once per calendar day (determined by the user's local timezone), capped at the remaining daily coin allowance defined by `coin_config.coin.maxDailyRewards` minus coins already earned that day
2. IF the user has already claimed the Daily_Step_Goal_Reward for the current calendar day, THEN THE Coin_System SHALL reject the claim request, preserve the existing coin balance unchanged, and return an error response indicating the reward has already been claimed for today
3. THE Coin_System SHALL use the `coin_config.rewards.daily_step_goal_reached.coin_value` from the Backend_Config_Service to determine the reward amount
4. IF the `coin_config.rewards.daily_step_goal_reached.enabled` flag is false, THEN THE Coin_System SHALL reject the claim request and return an error response indicating the reward is currently disabled, regardless of whether the user has reached their step goal
5. WHEN the Daily_Step_Goal_Reward is successfully awarded, THE Coin_System SHALL record the claim in the user's claim history with the reward identifier, awarded coin amount, and timestamp, and update the user's last step-goal coin date to prevent duplicate claims within the same calendar day

### Requirement 4: Backend Configuration for Daily Step Goal Reward

**User Story:** As an admin, I want to configure the daily step goal reward value and toggle it on or off, so that I can control the incentive structure dynamically.

#### Acceptance Criteria

1. THE Backend_Config_Service SHALL store the Daily_Step_Goal_Reward configuration at the path `coin_config.rewards.daily_step_goal_reached` containing an `enabled` flag and a `coin_value` field
2. THE Backend_Config_Service SHALL default `coin_config.rewards.daily_step_goal_reached.enabled` to true and `coin_config.rewards.daily_step_goal_reached.coin_value` to 50
3. WHEN an admin updates the daily step goal reward configuration, THE Backend_Config_Service SHALL persist the changes and serve them on subsequent Config_Endpoint requests
4. THE Backend_Config_Service SHALL validate that `coin_value` is a non-negative integer before persisting an update
5. IF a daily step goal reward update fails validation, THEN THE Backend_Config_Service SHALL reject the request, return an error response indicating the validation failure reason, and leave the previously stored configuration unchanged

### Requirement 5: Retention of Existing Coin Sources

**User Story:** As a product owner, I want all existing coin sources (streak bonuses, login rewards, referral bonuses) to continue working alongside the new and redesigned sources, so that users retain all their earning opportunities.

#### Acceptance Criteria

1. THE Coin_System SHALL support the following coin earning sources: Challenge_Reward, Hydration_Reward, Daily_Step_Goal_Reward, per-100-steps base earning, streak bonuses, login rewards, and referral bonuses
2. THE Coin_System SHALL preserve the existing streak bonus coin award logic (including streak badge coin rewards) without modification
3. THE Coin_System SHALL preserve the existing login reward coin award logic without modification
4. THE Coin_System SHALL preserve the existing referral bonus coin award logic (referrer and referee bonuses) without modification
5. THE Coin_System SHALL preserve the existing Challenge_Reward logic without modification
6. THE Coin_System SHALL preserve the existing Hydration_Reward logic without modification
7. THE Coin_System SHALL record all coin earnings from every source (including streak bonuses, login rewards, and referral bonuses) in the user's transaction history with the source identifier, coin amount, and timestamp
8. THE Coin_System SHALL only modify the step-based earning component (replacing the old calculation with the new per-100-steps configurable rate) and add the new Daily_Step_Goal_Reward; all other sources remain unchanged

### Requirement 6: Client-Side Config Fetching and Fallback

**User Story:** As a user, I want the app to work reliably even when the server is unreachable, so that I can still earn coins based on sensible defaults.

#### Acceptance Criteria

1. WHEN the Client_App starts a new session (cold launch or returns to foreground after more than 10 minutes since the last successful fetch), THE Client_App SHALL send a request to the Config_Endpoint to retrieve the coin configuration
2. IF the Config_Endpoint request fails or does not respond within 10 seconds, THEN THE Client_App SHALL resolve coin configuration using the following priority: (a) the most recently persisted config from a prior successful fetch, or (b) if no persisted config exists, the built-in initial defaults of `coin_config.steps.rate_per_100_steps` = 0.00095 and `coin_config.rewards.daily_step_goal_reached` = {enabled: true, coin_value: 50}
3. THE Client_App SHALL read all coin values (Step_Rate and Daily_Step_Goal_Reward) exclusively from the config store at the point of use; no coin calculation logic SHALL contain inline numeric literals for these values
4. WHEN a successful config response is received from the Config_Endpoint, THE Client_App SHALL apply the coin configuration to the active config store immediately and then persist it to local storage; fallback configs (from local storage or defaults) SHALL be applied directly without additional persistence
5. IF the Config_Endpoint returns a response that is missing required coin configuration fields (`coin_config.steps.rate_per_100_steps` or `coin_config.rewards.daily_step_goal_reached`), THEN THE Client_App SHALL treat the response as a failure and fall back to the resolution order defined in criterion 2

### Requirement 7: Real-Time Step-Based Earning Calculation

**User Story:** As a user, I want my step earnings to update in real time as I walk, so that I can see my progress without waiting.

#### Acceptance Criteria

1. WHEN the Client_App receives a step count update from the step sensor, THE Coin_System SHALL recalculate the step-based earnings using the current Step_Rate and the formula defined in Requirement 1
2. WHILE the Client_App is in the foreground, THE Client_App SHALL recalculate step-based earnings at a Sync_Interval not exceeding 30 seconds
3. WHEN the user opens the coin balance screen, THE Client_App SHALL display step-based earnings that are no older than 30 seconds without requiring a manual refresh; IF the available data exceeds 30 seconds of age, THEN THE Client_App SHALL display the stale data with a staleness indicator while triggering an immediate recalculation
4. IF the step sensor becomes unavailable or stops delivering updates, THEN THE Client_App SHALL retain and display the last successfully calculated step-based earnings and continue recalculation attempts at the Sync_Interval

### Requirement 8: Admin Dashboard Controls

**User Story:** As an admin, I want a dashboard interface to adjust the step rate and daily goal reward, so that I can make changes quickly without database access.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL expose authenticated, admin-role-protected endpoints to view and update `coin_config.steps.rate_per_100_steps`
2. THE Admin_Dashboard SHALL expose authenticated, admin-role-protected endpoints to view and update `coin_config.rewards.daily_step_goal_reached.enabled` and `coin_config.rewards.daily_step_goal_reached.coin_value`
3. WHEN an admin submits a configuration change, THE Admin_Dashboard SHALL return the new active values for the updated fields in the response body to confirm persistence
4. THE Admin_Dashboard SHALL not expose controls that modify the existing Challenge_Reward or Hydration_Reward configuration through this interface
5. IF an admin submits an invalid configuration value (non-positive Step_Rate, non-boolean enabled flag, or non-negative-integer coin_value), THEN THE Admin_Dashboard SHALL reject the request with an error response indicating which field failed validation and SHALL preserve the previously active configuration unchanged

### Requirement 9: Configuration Endpoint Schema

**User Story:** As a mobile developer, I want a well-defined JSON schema for the coin config endpoint, so that I can reliably parse and apply configuration values.

#### Acceptance Criteria

1. THE Config_Endpoint SHALL include `coin_config.steps.rate_per_100_steps` as a non-null numeric field with a value between 0 and 1000 (inclusive) in the response JSON
2. THE Config_Endpoint SHALL include `coin_config.rewards.daily_step_goal_reached` as a non-null object containing `enabled` (boolean, non-null) and `coin_value` (integer between 0 and 10000 inclusive, non-null) fields in the response JSON
3. THE Config_Endpoint SHALL continue to include all existing top-level configuration sections (coin, steps, rewards, features, maintenance, support) with their current field structure alongside the new coin_config section, preserving backward compatibility
4. WHEN an authenticated request is received, THE Config_Endpoint SHALL return a JSON response with HTTP 200 and Content-Type header set to `application/json`
5. IF an unauthenticated request is received, THEN THE Config_Endpoint SHALL return an HTTP 401 response with an error message indicating authentication is required, without exposing configuration data
6. THE Config_Endpoint SHALL return default values for all `coin_config` fields when no administrator override has been configured, ensuring the response never contains null values for `coin_config.steps.rate_per_100_steps`, `coin_config.rewards.daily_step_goal_reached.enabled`, or `coin_config.rewards.daily_step_goal_reached.coin_value`
