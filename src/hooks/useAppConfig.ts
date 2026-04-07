// src/hooks/useAppConfig.ts
// ─── Fetches /config/app once per session and keeps Zustand store in sync ───
import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { appConfigService } from '../services/appConfigService';
import { useAppConfigStore } from '../store/appConfigStore';

/**
 * Call this once near the root of the app (e.g. in the AuthenticatedStack or
 * App.tsx) to ensure the live server config is loaded into the store.
 *
 * All screens read from the store via `useAppConfigStore`, so they
 * automatically re-render when config updates.
 */
export function useAppConfig() {
  const setConfig = useAppConfigStore(s => s.setConfig);
  const lastFetchedAt = useAppConfigStore(s => s.lastFetchedAt);

  const { mutate: fetchConfig, isPending, isError } = useMutation({
    mutationFn: appConfigService.fetchConfig,
    onSuccess: config => setConfig(config),
    // On error, we silently fall back to the persisted / default config
    onError: err => {
      console.warn('[AppConfig] Failed to fetch remote config:', err);
    },
  });

  useEffect(() => {
    // Re-fetch if never fetched, or if last fetch was > 10 minutes ago
    const TEN_MIN = 10 * 60 * 1000;
    if (!lastFetchedAt || Date.now() - lastFetchedAt > TEN_MIN) {
      fetchConfig();
    }
  }, [fetchConfig, lastFetchedAt]);

  return { isPending, isError };
}
