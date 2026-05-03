// src/hooks/useWidgetSync.ts
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { widgetService } from '../services/widgetService';

interface UseWidgetSyncOptions {
  steps: number;
  goal: number;
  enabled?: boolean;
}

/**
 * Hook to automatically sync steps data to the home screen widget
 * Updates widget when:
 * - Steps or goal changes
 * - App comes to foreground
 * - Component mounts
 */
export function useWidgetSync({ steps, goal, enabled = true }: UseWidgetSyncOptions) {
  const appState = useRef(AppState.currentState);
  const lastSyncedSteps = useRef<number | null>(null);
  const lastSyncedGoal = useRef<number | null>(null);

  // Function to update widget
  const updateWidget = async () => {
    if (!enabled || !widgetService.isAvailable()) {
      return;
    }

    // Only update if values actually changed
    if (lastSyncedSteps.current === steps && lastSyncedGoal.current === goal) {
      return;
    }

    const success = await widgetService.updateWidget(steps, goal);
    if (success) {
      lastSyncedSteps.current = steps;
      lastSyncedGoal.current = goal;
    }
  };

  // Update widget when steps or goal changes
  useEffect(() => {
    updateWidget();
  }, [steps, goal, enabled]);

  // Update widget when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground
        updateWidget();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [steps, goal, enabled]);

  return {
    updateWidget,
    isAvailable: widgetService.isAvailable(),
  };
}
