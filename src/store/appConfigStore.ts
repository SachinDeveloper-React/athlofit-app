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
