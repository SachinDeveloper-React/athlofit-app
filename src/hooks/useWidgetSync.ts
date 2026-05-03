// src/hooks/useWidgetSync.ts
import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { widgetService } from '../services/widgetService';

interface UseWidgetSyncOptions {
  steps: number;
  goal: number;
  /**
   * Only sync when true. Pass `isAuthenticated && isReady` so the widget is
   * never updated before health data has been loaded (prevents crash on cold
   * start when the widget background job has already written step data).
   */
  enabled?: boolean;
}

/**
 * Hook to automatically sync steps data to the home screen widget.
 * Updates widget when:
 * - Steps or goal changes (and health data is ready)
 * - App comes to foreground (and health data is ready)
 * - Component mounts (and health data is ready)
 */
export function useWidgetSync({ steps, goal, enabled = true }: UseWidgetSyncOptions) {
  const appState = useRef(AppState.currentState);
  const lastSyncedSteps = useRef<number | null>(null);
  const lastSyncedGoal = useRef<number | null>(null);

  // Keep a ref to the latest values so the AppState listener never captures
  // stale closure values (avoids the widget being updated with 0 steps on
  // foreground when the real step count has already loaded).
  const stepsRef = useRef(steps);
  const goalRef = useRef(goal);
  const enabledRef = useRef(enabled);

  useEffect(() => { stepsRef.current = steps; }, [steps]);
  useEffect(() => { goalRef.current = goal; }, [goal]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const updateWidget = useCallback(async (s: number, g: number) => {
    if (!enabledRef.current || !widgetService.isAvailable()) return;

    // Skip if nothing changed since last successful sync
    if (lastSyncedSteps.current === s && lastSyncedGoal.current === g) return;

    const success = await widgetService.updateWidget(s, g);
    if (success) {
      lastSyncedSteps.current = s;
      lastSyncedGoal.current = g;
    }
  }, []);

  // Update widget when steps, goal, or enabled changes
  useEffect(() => {
    if (!enabled) return;
    updateWidget(steps, goal);
  }, [steps, goal, enabled, updateWidget]);

  // Update widget when app comes to foreground — always reads from refs so
  // the listener is stable and never needs to be re-registered.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // Use refs to get the latest values — avoids stale closure crash
        updateWidget(stepsRef.current, goalRef.current);
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
    // Intentionally empty deps — listener is stable via refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateWidget]);

  return {
    updateWidget: () => updateWidget(stepsRef.current, goalRef.current),
    isAvailable: widgetService.isAvailable(),
  };
}
