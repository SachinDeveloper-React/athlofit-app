import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useNetworkStore } from '../store/networkStore';
import { syncEngine } from './syncEngine';

const DEBOUNCE_MS = 3000;

/**
 * Determines the effective online status from a NetInfo state.
 * Uses `isInternetReachable` as primary signal, falls back to `isConnected`.
 * Maps null/undefined/unknown to offline (fail-safe).
 */
function resolveOnlineStatus(state: NetInfoState): boolean {
  if (state.isInternetReachable != null) {
    return state.isInternetReachable;
  }
  if (state.isConnected != null) {
    return state.isConnected;
  }
  return false;
}

/**
 * Applies the resolved connectivity state to the network store and React Query.
 * Only emits if the value actually changed (deduplication is also handled by the store).
 */
function commitState(online: boolean): void {
  useNetworkStore.getState().setOnline(online);
  onlineManager.setOnline(online);
}

/**
 * ConnectivityMonitor — singleton service that wraps NetInfo, applies a 3-second
 * debounce stabilization window, and updates the network store + React Query.
 */
export const connectivityMonitor = (() => {
  let unsubscribe: (() => void) | null = null;
  let unsubscribeStore: (() => void) | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastCommittedValue: boolean | null = null;

  /**
   * Initialize the monitor. Fetches initial state immediately (no debounce),
   * then subscribes to ongoing connectivity changes with debounce.
   * Call once at app startup before navigation renders.
   */
  async function initialize(): Promise<void> {
    // Fetch initial state — apply immediately without debounce
    const initialState = await NetInfo.fetch();
    const initialOnline = resolveOnlineStatus(initialState);

    lastCommittedValue = initialOnline;
    commitState(initialOnline);

    // Subscribe to ongoing changes with debounce
    unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = resolveOnlineStatus(state);

      // Clear any pending debounce timer (reset the window)
      if (debounceTimer != null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }

      // Start a new 3-second stabilization window
      debounceTimer = setTimeout(() => {
        debounceTimer = null;

        // Only emit if the value actually changed from last committed
        if (online !== lastCommittedValue) {
          lastCommittedValue = online;
          commitState(online);
        }
      }, DEBOUNCE_MS);
    });

    // Subscribe to store: trigger sync drain on offline→online transition
    let prevOnline = useNetworkStore.getState().isOnline;
    unsubscribeStore = useNetworkStore.subscribe((state) => {
      if (state.isOnline && !prevOnline) {
        syncEngine.drain();
      }
      prevOnline = state.isOnline;
    });
  }

  /**
   * Tear down the NetInfo listener and clear any pending debounce timers.
   * Call on app unmount or test cleanup.
   */
  function destroy(): void {
    if (unsubscribe != null) {
      unsubscribe();
      unsubscribe = null;
    }

    if (unsubscribeStore != null) {
      unsubscribeStore();
      unsubscribeStore = null;
    }

    if (debounceTimer != null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    lastCommittedValue = null;
  }

  return { initialize, destroy };
})();
