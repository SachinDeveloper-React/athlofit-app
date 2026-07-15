// src/hooks/useBatteryOptimization.ts
// Checks battery optimization status and prompts user to disable it.
// This prevents OEMs (Xiaomi, Samsung, Realme, Oppo) from killing the
// step counter service, which causes missed midnight resets and delayed data.

import { useEffect, useState, useCallback } from 'react';
import { Platform, AppState } from 'react-native';
import { mmkv } from '../store';
import { stepService } from '../services/stepService';

const DISMISSED_KEY = 'battery_opt_prompt_dismissed';
const DISMISSED_COUNT_KEY = 'battery_opt_dismiss_count';
const MAX_DISMISSALS = 3; // Stop nagging after 3 dismissals

interface BatteryOptState {
  /** Whether the prompt should be shown */
  shouldPrompt: boolean;
  /** Whether the app is already exempt from battery optimization */
  isOptimized: boolean;
  /** Open the system dialog to disable battery optimization */
  requestDisable: () => Promise<void>;
  /** Open battery settings page (fallback) */
  openSettings: () => Promise<void>;
  /** Dismiss the prompt (user chose "Later") */
  dismiss: () => Promise<void>;
  /** Re-check the status (call when app returns from settings) */
  recheck: () => Promise<void>;
}

export function useBatteryOptimization(): BatteryOptState {
  const [isOptimized, setIsOptimized] = useState(true); // true = already exempt (good)
  const [isDismissed, setIsDismissed] = useState(true);

  const checkStatus = useCallback(async () => {
    if (Platform.OS !== 'android') return;

    const exempt = await stepService.isIgnoringBatteryOptimizations();
    setIsOptimized(exempt);

    if (exempt) {
      // Already good — no need to prompt
      setIsDismissed(true);
      return;
    }

    // Check if user has dismissed too many times
    const count = mmkv.getNumber(DISMISSED_COUNT_KEY) ?? 0;
    if (count >= MAX_DISMISSALS) {
      setIsDismissed(true);
      return;
    }

    // Check if dismissed in this session (timestamp-based, re-show after 24h)
    const dismissedAt = mmkv.getNumber(DISMISSED_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - dismissedAt;
      const ONE_DAY = 24 * 60 * 60 * 1000;
      if (elapsed < ONE_DAY) {
        setIsDismissed(true);
        return;
      }
    }

    setIsDismissed(false);
  }, []);

  useEffect(() => {
    checkStatus();

    // Re-check when app comes back to foreground (user may have changed settings)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkStatus();
      }
    });

    return () => sub.remove();
  }, [checkStatus]);

  const requestDisable = useCallback(async () => {
    await stepService.requestDisableBatteryOptimization();
  }, []);

  const openSettings = useCallback(async () => {
    await stepService.openBatterySettings();
  }, []);

  const dismiss = useCallback(async () => {
    setIsDismissed(true);
    mmkv.set(DISMISSED_KEY, Date.now());
    const count = mmkv.getNumber(DISMISSED_COUNT_KEY) ?? 0;
    mmkv.set(DISMISSED_COUNT_KEY, count + 1);
  }, []);

  const recheck = useCallback(async () => {
    await checkStatus();
  }, [checkStatus]);

  const shouldPrompt = Platform.OS === 'android' && !isOptimized && !isDismissed;

  return {
    shouldPrompt,
    isOptimized,
    requestDisable,
    openSettings,
    dismiss,
    recheck,
  };
}
