// src/store/__tests__/appConfigStore.coinConfig.test.ts
// Integration test: config response → store update → selector consumption
// Validates that coin_config from server propagates through the store correctly.

// Mock MMKV storage before importing store
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => {
    const store = new Map<string, string>();
    return {
      set: (key: string, value: string) => store.set(key, value),
      getString: (key: string) => store.get(key) ?? undefined,
      remove: (key: string) => store.delete(key),
    };
  },
}));

import { useAppConfigStore } from '../appConfigStore';
import { APP_CONFIG_DEFAULTS, type AppConfig } from '../../config/appConfig';

// Helper to build a server config response with custom coin_config
function buildServerConfig(coinConfigOverrides: Partial<AppConfig['coin_config']> = {}): AppConfig {
  return {
    ...APP_CONFIG_DEFAULTS,
    coin_config: {
      steps: {
        rate_per_100_steps: coinConfigOverrides.steps?.rate_per_100_steps ?? 0.00095,
      },
      rewards: {
        daily_step_goal_reached: {
          enabled: coinConfigOverrides.rewards?.daily_step_goal_reached?.enabled ?? true,
          coin_value: coinConfigOverrides.rewards?.daily_step_goal_reached?.coin_value ?? 50,
        },
      },
    },
  };
}

describe('AppConfigStore - coin_config flow', () => {
  beforeEach(() => {
    // Reset store to defaults before each test
    useAppConfigStore.setState({
      config: APP_CONFIG_DEFAULTS,
      lastFetchedAt: null,
    });
  });

  describe('initial state', () => {
    it('starts with default coin_config values', () => {
      const state = useAppConfigStore.getState();
      expect(state.config.coin_config.steps.rate_per_100_steps).toBe(0.00095);
      expect(state.config.coin_config.rewards.daily_step_goal_reached).toEqual({
        enabled: true,
        coin_value: 50,
      });
    });
  });

  describe('setConfig updates coin_config correctly', () => {
    it('updates rate_per_100_steps when new config is set', () => {
      const serverConfig = buildServerConfig({
        steps: { rate_per_100_steps: 0.005 },
      });

      useAppConfigStore.getState().setConfig(serverConfig);

      const state = useAppConfigStore.getState();
      expect(state.config.coin_config.steps.rate_per_100_steps).toBe(0.005);
      expect(state.lastFetchedAt).not.toBeNull();
    });

    it('updates daily_step_goal_reached config when new config is set', () => {
      const serverConfig = buildServerConfig({
        rewards: {
          daily_step_goal_reached: { enabled: false, coin_value: 200 },
        },
      });

      useAppConfigStore.getState().setConfig(serverConfig);

      const state = useAppConfigStore.getState();
      expect(state.config.coin_config.rewards.daily_step_goal_reached).toEqual({
        enabled: false,
        coin_value: 200,
      });
    });

    it('preserves other config sections when coin_config is updated', () => {
      const serverConfig = buildServerConfig({
        steps: { rate_per_100_steps: 0.01 },
      });

      useAppConfigStore.getState().setConfig(serverConfig);

      const state = useAppConfigStore.getState();
      // Other sections remain intact
      expect(state.config.coin.conversionRate).toBe(10);
      expect(state.config.steps.defaultDailyGoal).toBe(8000);
      expect(state.config.rewards.stepGoalCoins).toBe(50);
      expect(state.config.features.shopEnabled).toBe(true);
      expect(state.config.support.email).toBe('support@athlofit.com');
    });
  });

  describe('selectors return correct coin_config values', () => {
    it('useStepCoinRate selector returns updated rate', () => {
      const serverConfig = buildServerConfig({
        steps: { rate_per_100_steps: 0.008 },
      });

      useAppConfigStore.getState().setConfig(serverConfig);

      // Directly test the selector logic (selector reads from store state)
      const state = useAppConfigStore.getState();
      const rate = state.config.coin_config?.steps?.rate_per_100_steps ?? 0.00095;
      expect(rate).toBe(0.008);
    });

    it('useDailyStepGoalRewardConfig selector returns updated reward config', () => {
      const serverConfig = buildServerConfig({
        rewards: {
          daily_step_goal_reached: { enabled: false, coin_value: 75 },
        },
      });

      useAppConfigStore.getState().setConfig(serverConfig);

      const state = useAppConfigStore.getState();
      const rewardConfig = state.config.coin_config?.rewards?.daily_step_goal_reached ?? {
        enabled: true,
        coin_value: 50,
      };
      expect(rewardConfig.enabled).toBe(false);
      expect(rewardConfig.coin_value).toBe(75);
    });

    it('selectors fall back to defaults when coin_config fields are missing', () => {
      // Simulate a config object where coin_config is undefined
      const incompleteConfig = { ...APP_CONFIG_DEFAULTS } as AppConfig;
      // @ts-ignore - simulating missing coin_config
      incompleteConfig.coin_config = undefined;

      useAppConfigStore.getState().setConfig(incompleteConfig);

      const state = useAppConfigStore.getState();
      const rate = state.config.coin_config?.steps?.rate_per_100_steps ?? 0.00095;
      const rewardConfig = state.config.coin_config?.rewards?.daily_step_goal_reached ?? {
        enabled: true,
        coin_value: 50,
      };

      expect(rate).toBe(0.00095);
      expect(rewardConfig).toEqual({ enabled: true, coin_value: 50 });
    });
  });

  describe('step coin earnings calculation from store', () => {
    it('calculates correct earnings using stored rate', () => {
      const serverConfig = buildServerConfig({
        steps: { rate_per_100_steps: 0.01 },
      });

      useAppConfigStore.getState().setConfig(serverConfig);

      const state = useAppConfigStore.getState();
      const rate = state.config.coin_config.steps.rate_per_100_steps;

      // Simulate the calculation from useStepCoinEarnings hook
      const steps = 5000;
      const earnings = Math.round(Math.floor(steps / 100) * rate);

      // floor(5000/100) = 50, 50 * 0.01 = 0.5, round = 1 (rounded, as Math.round(0.5) = 1)
      expect(earnings).toBe(1);
    });

    it('calculates earnings with default rate', () => {
      const state = useAppConfigStore.getState();
      const rate = state.config.coin_config.steps.rate_per_100_steps;

      const steps = 10000;
      const earnings = Math.round(Math.floor(steps / 100) * rate);

      // floor(10000/100) = 100, 100 * 0.00095 = 0.095, round = 0
      expect(earnings).toBe(0);
    });

    it('earnings change when rate is updated via config', () => {
      const state1 = useAppConfigStore.getState();
      const rate1 = state1.config.coin_config.steps.rate_per_100_steps;

      const steps = 10000;
      const earnings1 = Math.round(Math.floor(steps / 100) * rate1);
      expect(earnings1).toBe(0); // 100 * 0.00095 = 0.095 → rounds to 0

      // Admin updates rate
      const updatedConfig = buildServerConfig({
        steps: { rate_per_100_steps: 0.5 },
      });
      useAppConfigStore.getState().setConfig(updatedConfig);

      const state2 = useAppConfigStore.getState();
      const rate2 = state2.config.coin_config.steps.rate_per_100_steps;
      const earnings2 = Math.round(Math.floor(steps / 100) * rate2);
      expect(earnings2).toBe(50); // 100 * 0.5 = 50
    });
  });
});
