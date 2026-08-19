// src/hooks/useWidgetSync.ts
import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { widgetService } from '../services/widgetService';
import { stepService } from '../services/stepService';

interface UseWidgetSyncOptions {
  steps: number;
  goal: number;
  /**
   * Only sync when true. Pass `isAuthenticated && isReady` so the widget is
   * never updated before health data has been loaded.
   */
  enabled?: boolean;
}

/**
 * Syncs the current step count to the home-screen widget AND notification.
 *
 * Rules:
 *  - Never overwrite a known count with 0 — the background worker may already
 *    have written a valid value and a cold start would blank it. A goal-only
 *    change still goes through, carrying the last known count.
 *  - Only push when the value actually changed since the last successful sync.
 *  - Re-push when the app comes to foreground (in case the widget was reset).
 *  - Also pushes to the native notification so all surfaces stay in sync.
 */
export function useWidgetSync({ steps, goal, enabled = true }: UseWidgetSyncOptions) {
  const appState = useRef(AppState.currentState);
  const lastSyncedSteps = useRef<number | null>(null);
  const lastSyncedGoal  = useRef<number | null>(null);

  // Stable refs so the AppState listener never captures stale closures
  const stepsRef   = useRef(steps);
  const goalRef    = useRef(goal);
  const enabledRef = useRef(enabled);

  useEffect(() => { stepsRef.current   = steps;   }, [steps]);
  useEffect(() => { goalRef.current    = goal;    }, [goal]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const syncToWidget = useCallback(async (s: number, g: number) => {
    if (!enabledRef.current)          return; // not ready yet
    if (!widgetService.isAvailable()) return; // iOS or module missing

    // Skip if nothing changed since last successful push
    if (lastSyncedSteps.current === s && lastSyncedGoal.current === g) return;

    // Never overwrite a non-zero count with 0 — the background worker may
    // already have written a valid value and a cold start would blank it.
    //
    // But a goal change still has to get through. The goal reaches the widget
    // only from here, and this used to bail on `s <= 0` before the write, so any
    // goal edit made while steps were 0 (early morning, straight after midnight,
    // before the first Health Connect read) never arrived — the widget kept
    // rendering the old goal, and on a fresh install the 10,000 default, until
    // the user happened to change it again after walking.
    const goalOnly = s <= 0;
    if (goalOnly && lastSyncedGoal.current === g) return;

    const stepsToWrite = goalOnly ? Math.max(0, lastSyncedSteps.current ?? 0) : s;

    const ok = await widgetService.updateWidget(stepsToWrite, g);
    if (ok) {
      if (!goalOnly) lastSyncedSteps.current = s;
      lastSyncedGoal.current  = g;
    }

    // FIX: Removed forceRefreshSteps call. Feeding HC/server-derived step
    // counts back into the native service's liveStepCount caused a circular
    // inflation loop. The native sensor service manages its own notification
    // updates directly from the hardware pedometer.
  }, []);

  // Push whenever steps, goal, or enabled changes. Zero steps no longer skip the
  // push outright — syncToWidget keeps the last known count in that case and lets
  // a goal change through on its own.
  useEffect(() => {
    if (!enabled) return;
    syncToWidget(steps, goal);
  }, [steps, goal, enabled, syncToWidget]);

  // Re-push when app comes to foreground (widget may have been reset by OS)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        next === 'active'
      ) {
        // Reset lastSynced so the push isn't skipped — the user is returning
        // to the app and expects notification/widget to reflect current data.
        lastSyncedSteps.current = null;
        lastSyncedGoal.current = null;
        syncToWidget(stepsRef.current, goalRef.current);
      }
      appState.current = next;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncToWidget]);

  return {
    syncNow:     () => syncToWidget(stepsRef.current, goalRef.current),
    isAvailable: widgetService.isAvailable(),
  };
}
