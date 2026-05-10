// src/hooks/useWidgetSync.ts
import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { widgetService } from '../services/widgetService';

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
 * Syncs the current step count to the home-screen widget.
 *
 * Rules:
 *  - Never push 0 steps — the background worker may have already written a
 *    valid non-zero value; overwriting it with 0 on cold start looks broken.
 *  - Only push when the value actually changed since the last successful sync.
 *  - Re-push when the app comes to foreground (in case the widget was reset).
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
    if (s <= 0)                       return; // never overwrite with 0

    // Skip if nothing changed since last successful push
    if (lastSyncedSteps.current === s && lastSyncedGoal.current === g) return;

    const ok = await widgetService.updateWidget(s, g);
    if (ok) {
      lastSyncedSteps.current = s;
      lastSyncedGoal.current  = g;
    }
  }, []);

  // Push whenever steps, goal, or enabled changes — but only if steps > 0
  useEffect(() => {
    if (!enabled || steps <= 0) return;
    syncToWidget(steps, goal);
  }, [steps, goal, enabled, syncToWidget]);

  // Re-push when app comes to foreground (widget may have been reset by OS)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        next === 'active'
      ) {
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
