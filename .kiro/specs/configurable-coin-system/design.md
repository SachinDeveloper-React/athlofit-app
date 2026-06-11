# Technical Design Document

## Overview

This design describes how to make the step-based coin earning system fully backend-configurable while preserving all existing coin sources (challenges, hydration, streaks, login rewards, referral bonuses). The changes add a new `coin_config` section to the AppConfig model, expose it via the existing config endpoint, and modify the client-side coin calculation to use the configurable rate instead of hardcoded values.

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin (API Client)                        │
│                                                              │
│  PATCH /config/app { coin_config: { ... } }                  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Node.js/Express)                   │
│                                                              │
│  ┌──────────────┐    ┌──────────────────┐                   │
│  │ Config       │    │ Gamification     │                    │
│  │ Controller   │    │ Controller       │                    │
│  │              │    │                  │                    │
│  │ GET /config/ │    │ POST /coins/     │                    │
│  │ app          │    │ claim-step-goal  │                    │
│  └──────┬───────┘    └────────┬─────────┘                   │
│         │                     │                              │
│         ▼                     ▼                              │
│  ┌─────────────────────────────────────┐                    │
│  │         AppConfig Model             │                    │
│  │  (MongoDB - single document)        │                    │
│  │                                     │                    │
│  │  + coin_config.steps.               │                    │
│  │      rate_per_100_steps             │                    │
│  │  + coin_config.rewards.             │                    │
│  │      daily_step_goal_reached        │                    │
│  │        .enabled                     │                    │
│  │        .coin_value                  │                    │
│  └─────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ GET /config/app response
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Client (React Native App)                        │
│                                                              │
│  ┌────────────────┐   ┌───────────────────────┐             │
│  │ AppConfig      │   │ Gamification Store     │             │
│  │ Store (Zustand)│   │ (Zustand + MMKV)      │             │
│  │                │   │                       │             │
│  │ coin_config:   │   │ stepCoinEarnings      │             │
│  │  steps.rate    │   │ dailyGoalClaimed      │             │
│  │  rewards.goal  │   │ coinsBalance          │             │
│  └───────┬────────┘   └───────────┬───────────┘             │
│          │                        │                          │
│          ▼                        ▼                          │
│  ┌─────────────────────────────────────────┐                │
│  │  useStepCoinEarnings Hook               │                │
│  │                                         │                │
│  │  - Reads steps from StepService         │                │
│  │  - Reads rate from AppConfigStore       │                │
│  │  - Calculates: floor(steps/100) × rate  │                │
│  │  - Recalculates every ≤30s              │                │
│  └─────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Config Fetch Flow**: App launch → `appConfigService.fetchConfig()` → GET /config/app → response includes `coin_config` → stored in `useAppConfigStore` (persisted to MMKV)
2. **Step Earning Flow**: Step sensor update → `useStepCoinEarnings` hook recalculates → `floor(steps / 100) × rate` → display in UI → sync to backend via `earnCoins` endpoint
3. **Daily Goal Claim Flow**: User hits step goal → client calls `POST /gamification/coins/claim-step-goal` → backend validates (enabled, not already claimed, goal met) → awards coins → records in claim history
4. **Admin Config Update Flow**: Admin calls `PATCH /config/app` with `coin_config` updates → backend validates → persists → next client fetch gets new values

## Components and Interfaces

### Backend Components

#### 1. AppConfig Model Changes (`src/models/AppConfig.model.js`)

Add `coin_config` field to the existing schema:

```javascript
coin_config: {
  steps: {
    rate_per_100_steps: { type: Number, default: 0.00095 },
  },
  rewards: {
    daily_step_goal_reached: {
      enabled:    { type: Boolean, default: true },
      coin_value: { type: Number, default: 50 },
    },
  },
},
```

**Rationale**: Adding a new top-level `coin_config` field (separate from the existing `coin` and `rewards` fields) provides a clean namespace for the new configurable system without risking breakage to existing config consumers.

#### 2. Config Controller Changes (`src/controllers/config.controller.js`)

Modify `getAppConfig` to include `coin_config` in the response:

```javascript
// Add to the config response object:
coin_config: {
  steps: {
    rate_per_100_steps: cfg.coin_config?.steps?.rate_per_100_steps ?? 0.00095,
  },
  rewards: {
    daily_step_goal_reached: {
      enabled:    cfg.coin_config?.rewards?.daily_step_goal_reached?.enabled ?? true,
      coin_value: cfg.coin_config?.rewards?.daily_step_goal_reached?.coin_value ?? 50,
    },
  },
},
```

The existing `updateAppConfig` (PATCH) already supports deep-merging arbitrary fields via the flat `$set` map pattern, so admin updates to `coin_config.*` paths work without additional code changes.

#### 3. Gamification Controller — Modified Claim Logic (`POST /gamification/coins/claim`)

The existing `claimReward` endpoint already handles `steps_daily` claims. We modify the `steps_daily` reward definition within `claimReward` to read from `coin_config` instead of `cfg.rewards.stepGoalCoins`:

```javascript
// In claimReward — modify the REWARDS.steps_daily definition:
steps_daily: {
  title: `Walk ${dailyGoal.toLocaleString()} Steps`,
  reward: cfg.coin_config?.rewards?.daily_step_goal_reached?.coin_value ?? cfg.rewards.stepGoalCoins,
  isMet: () => {
    // Check if reward is enabled via coin_config
    const enabled = cfg.coin_config?.rewards?.daily_step_goal_reached?.enabled ?? true;
    if (!enabled) return false;
    return todaySteps >= dailyGoal;
  },
  isAlreadyClaimed: () => gam.lastCoinDate === today,
  onClaim: () => { gam.lastCoinDate = today; },
},
```

Also add an explicit check: if `coin_config.rewards.daily_step_goal_reached.enabled` is false and the user tries to claim `steps_daily`, return a specific "reward is currently disabled" error before checking other conditions.

#### 4. Gamification Controller — Modified `earnCoins` Endpoint

The existing `POST /gamification/coins/earn` endpoint already handles step-based earning. No structural changes needed — the client will send the correctly calculated `coinsToAdd` value based on the configurable rate. The endpoint already validates positive amounts and applies the daily cap.

#### 5. Gamification Model — No Changes Needed

The existing `Gamification.model.js` already has:
- `stepGoalCoinDate` field for tracking daily step goal claims
- `claimHistory` array for recording coin transactions
- `coinsBalance`, `coinsEarnedToday`, `lastCoinDate` for coin tracking

No new fields are needed.

#### 5. Admin Validation (within existing `updateAppConfig`)

The existing PATCH endpoint already handles nested updates. We add validation logic in the controller for coin_config-specific fields:

```javascript
// In updateAppConfig, before persisting:
if (setMap['coin_config.steps.rate_per_100_steps'] !== undefined) {
  const rate = setMap['coin_config.steps.rate_per_100_steps'];
  if (typeof rate !== 'number' || rate <= 0 || rate > 1.0) {
    return error(res, 'rate_per_100_steps must be a positive number <= 1.0', 400);
  }
}
if (setMap['coin_config.rewards.daily_step_goal_reached.coin_value'] !== undefined) {
  const val = setMap['coin_config.rewards.daily_step_goal_reached.coin_value'];
  if (!Number.isInteger(val) || val < 0) {
    return error(res, 'coin_value must be a non-negative integer', 400);
  }
}
```

### Client Components

#### 1. AppConfig Type Extension (`src/config/appConfig.ts`)

Add `coin_config` to the `AppConfig` type and defaults:

```typescript
// Add to APP_CONFIG_DEFAULTS:
coin_config: {
  steps: {
    rate_per_100_steps: 0.00095,
  },
  rewards: {
    daily_step_goal_reached: {
      enabled: true,
      coin_value: 50,
    },
  },
},

// Add to AppConfig type:
coin_config: {
  steps: {
    rate_per_100_steps: number;
  };
  rewards: {
    daily_step_goal_reached: {
      enabled: boolean;
      coin_value: number;
    };
  };
};
```

#### 2. AppConfigStore Selectors (`src/store/appConfigStore.ts`)

Add new selectors:

```typescript
/** Selector: step coin rate per 100 steps */
export const useStepCoinRate = () =>
  useAppConfigStore(s => s.config.coin_config?.steps?.rate_per_100_steps ?? 0.00095);

/** Selector: daily step goal reward config */
export const useDailyStepGoalRewardConfig = () =>
  useAppConfigStore(s => s.config.coin_config?.rewards?.daily_step_goal_reached ?? { enabled: true, coin_value: 50 });
```

#### 3. Config Fetch with Validation (`src/services/appConfigService.ts`)

Add validation for required `coin_config` fields:

```typescript
fetchConfig: async (): Promise<AppConfig> => {
  const response = await api.get<AppConfigResponse>('config/app');
  if (!response.success || !response.data?.config) {
    throw new Error(response.message || 'Failed to fetch app config');
  }
  
  const config = response.data.config;
  
  // Validate required coin_config fields exist
  if (
    config.coin_config?.steps?.rate_per_100_steps == null ||
    config.coin_config?.rewards?.daily_step_goal_reached == null
  ) {
    throw new Error('Missing required coin_config fields');
  }
  
  return config;
},
```

#### 4. New Hook: `useStepCoinEarnings` (`src/features/health/hooks/useStepCoinEarnings.ts`)

This hook handles real-time step-based coin calculation:

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { stepService } from '../../../services/stepService';
import { useStepCoinRate } from '../../../store/appConfigStore';

const SYNC_INTERVAL_MS = 30_000; // 30 seconds

export function useStepCoinEarnings() {
  const rate = useStepCoinRate();
  const [steps, setSteps] = useState(0);
  const [lastCalcTime, setLastCalcTime] = useState(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const calculateEarnings = useCallback((currentSteps: number) => {
    return Math.round(Math.floor(currentSteps / 100) * rate);
  }, [rate]);

  // Subscribe to real-time step updates
  useEffect(() => {
    const unsubscribe = stepService.onStepUpdate((newSteps) => {
      setSteps(newSteps);
      setLastCalcTime(Date.now());
    });
    return unsubscribe;
  }, []);

  // Periodic recalculation (≤30s interval)
  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      const currentSteps = await stepService.getCurrentSteps();
      setSteps(currentSteps);
      setLastCalcTime(Date.now());
    }, SYNC_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const earnings = calculateEarnings(steps);
  const isStale = Date.now() - lastCalcTime > SYNC_INTERVAL_MS;

  return { earnings, steps, isStale, lastCalcTime };
}
```

#### 5. Modified `useEarnCoins` Hook

Update to use the configurable rate for the step earning call:

```typescript
// Replace fixed coin calculation with rate-based calculation
import { useStepCoinRate } from '../../../store/appConfigStore';

export function useEarnCoins() {
  const rate = useStepCoinRate();
  // ... existing code
  
  const calculateStepCoins = (steps: number) => {
    return Math.round(Math.floor(steps / 100) * rate);
  };
  
  // ... rest of hook
}
```

#### 6. New Hook: `useDailyStepGoalReward` (`src/features/health/hooks/useDailyStepGoalReward.ts`)

This hook wraps the existing `claimReward` mechanism with the new config-driven reward value:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { gamificationService } from '../service/gamification.service';
import { useDailyStepGoalRewardConfig } from '../../../store/appConfigStore';

export function useDailyStepGoalReward() {
  const queryClient = useQueryClient();
  const rewardConfig = useDailyStepGoalRewardConfig();

  const mutation = useMutation({
    mutationFn: () =>
      gamificationService.claimReward('steps_daily'), // uses existing claim endpoint
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coin-data'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    },
  });

  return {
    claimReward: mutation.mutate,
    isPending: mutation.isPending,
    isEnabled: rewardConfig.enabled,
    coinValue: rewardConfig.coin_value,
  };
}
```

#### 7. Gamification Service — No New Endpoints Needed

The existing `gamificationService.claimReward('steps_daily')` call already posts to `POST /gamification/coins/claim`. No new service method is needed.

### Routing Changes (Backend)

No new routes needed. The existing routes are sufficient:
- `GET /config/app` — already serves config (will now include `coin_config`)
- `PATCH /config/app` — already handles admin updates (will validate `coin_config` fields)
- `POST /gamification/coins/claim` — already handles `steps_daily` claims (modified to use `coin_config`)
- `POST /gamification/coins/earn` — already handles step-based earning (no changes needed)

## Data Models

### AppConfig (Modified)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| coin_config.steps.rate_per_100_steps | Number | 0.00095 | Coins earned per 100 steps |
| coin_config.rewards.daily_step_goal_reached.enabled | Boolean | true | Whether the reward is active |
| coin_config.rewards.daily_step_goal_reached.coin_value | Number | 50 | Coins awarded on goal completion |

### Gamification (No Changes Needed)

The existing model already has all required fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| stepGoalCoinDate | String | null | ISO date of last daily step goal claim (already exists) |
| claimHistory | Array | [] | Reward claim log (already exists) |
| coinsBalance | Number | 0 | Current coin balance (already exists) |
| coinsEarnedToday | Number | 0 | Coins earned today (already exists) |

### Config Endpoint Response (Extended)

```json
{
  "coin": { ... },
  "steps": { ... },
  "rewards": { ... },
  "features": { ... },
  "maintenance": { ... },
  "support": { ... },
  "coin_config": {
    "steps": {
      "rate_per_100_steps": 0.00095
    },
    "rewards": {
      "daily_step_goal_reached": {
        "enabled": true,
        "coin_value": 50
      }
    }
  }
}
```

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /config/app | Yes | Returns full config including new coin_config section |
| PATCH | /config/app | Admin | Updates config (including coin_config fields with validation) |
| POST | /gamification/coins/claim | Yes | Claims rewards (steps_daily now reads from coin_config) |
| POST | /gamification/coins/earn | Yes | Step-based earning (client sends calculated amount) |

## Error Handling

| Scenario | HTTP Code | Error Message |
|----------|-----------|---------------|
| Reward disabled | 400 | "Daily step goal reward is currently disabled" |
| Already claimed today | 400 | "Daily step goal reward already claimed today" |
| Goal not reached | 400 | "Step goal not yet reached" |
| Invalid rate_per_100_steps | 400 | "rate_per_100_steps must be a positive number <= 1.0" |
| Invalid coin_value | 400 | "coin_value must be a non-negative integer" |
| Config fetch fails (client) | N/A | Falls back to persisted/default config |

## Correctness Properties

### Property 1: Step Earning Determinism
For the same `total_daily_steps` value and `rate_per_100_steps` config value, the step-based earning calculation SHALL always produce the same result: `Math.round(Math.floor(steps / 100) * rate)`

**Validates: Requirements 1.1, 1.4**

### Property 2: Daily Goal Idempotency
Multiple calls to `claim-step-goal` within the same calendar day SHALL result in exactly one coin award — subsequent calls return an error without modifying the balance

**Validates: Requirements 3.1, 3.2**

### Property 3: Config Continuity
If the config endpoint is unreachable, the client SHALL continue using the last successfully fetched config (or built-in defaults), ensuring coin calculations never use `null` or `undefined` values

**Validates: Requirements 6.2, 6.5**

### Property 4: Backward Compatibility
The config endpoint response SHALL always include all existing top-level sections (`coin`, `steps`, `rewards`, `features`, `maintenance`, `support`) with unchanged structure

**Validates: Requirements 9.3**

### Property 5: Existing Source Preservation
Streak bonus, login reward, and referral bonus coin operations SHALL produce identical results before and after this change — their code paths are not modified

**Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 5.7**

## Testing Strategy

- **Backend unit tests**: Validate coin_config defaults in AppConfig model, validate admin update validation logic, test claim-step-goal endpoint (success, duplicate, disabled, cap)
- **Client unit tests**: Test `useStepCoinEarnings` hook calculations with various step counts and rates, test config fallback behavior
- **Integration tests**: End-to-end flow of admin updating config → client fetching new values → coin calculation using new rate
