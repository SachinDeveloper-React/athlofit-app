// src/store/appConfigStore.ts
// ─── Zustand store that holds the live server-driven app config ──────────────
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from './index';
import { APP_CONFIG_DEFAULTS, type AppConfig } from '../config/appConfig';

interface AppConfigStore {
  config: AppConfig;
  lastFetchedAt: number | null;
  setConfig: (config: AppConfig) => void;
}

export const useAppConfigStore = create<AppConfigStore>()(
  persist(
    set => ({
      config: APP_CONFIG_DEFAULTS,
      lastFetchedAt: null,
      setConfig: (config: AppConfig) =>
        set({ config, lastFetchedAt: Date.now() }),
    }),
    {
      name: 'app-config-store',
      storage: createJSONStorage(() => mmkvStorage),
      // Only persist config — derive lastFetchedAt from runtime
      partialize: state => ({ config: state.config }),
    },
  ),
);

/** Selector: coin conversion rate (coins per ₹1) */
export const useCoinRate = () =>
  useAppConfigStore(s => s.config.coin.conversionRate);

/** Selector: daily coin earn limit */
export const useDailyCoinLimit = () =>
  useAppConfigStore(s => s.config.coin.dailyEarnLimit);

/** Selector: step goal reward coins */
export const useStepGoalCoins = () =>
  useAppConfigStore(s => s.config.rewards?.stepGoalCoins ?? 50);

/** Selector: referrer bonus */
export const useReferrerBonus = () =>
  useAppConfigStore(s => s.config.coin.referrerBonus ?? 100);

/** Selector: referee bonus */
export const useRefereeBonus = () =>
  useAppConfigStore(s => s.config.coin.refereeBonus ?? 50);

/** Selector: support contact info */
export const useSupportContact = () =>
  useAppConfigStore(s => s.config.support ?? { email: 'support@athlofit.com', website: 'www.athlofit.com/faq' });

/** Selector: feature flags */
export const useFeatureFlags = () =>
  useAppConfigStore(s => s.config.features);
