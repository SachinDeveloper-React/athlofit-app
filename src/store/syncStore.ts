import { create } from 'zustand';

interface SyncState {
  /** Number of active sync/API requests currently in flight. */
  activeRequests: number;

  /** Whether any sync is currently happening. */
  isSyncing: boolean;

  /** Increment active request count (call when a request starts). */
  startSync: () => void;

  /** Decrement active request count (call when a request completes or fails). */
  endSync: () => void;
}

export const useSyncStore = create<SyncState>()((set, get) => ({
  activeRequests: 0,
  isSyncing: false,

  startSync: () => {
    const next = get().activeRequests + 1;
    set({ activeRequests: next, isSyncing: next > 0 });
  },

  endSync: () => {
    const next = Math.max(0, get().activeRequests - 1);
    set({ activeRequests: next, isSyncing: next > 0 });
  },
}));
