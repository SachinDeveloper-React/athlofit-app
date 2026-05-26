import { create } from 'zustand';
import { useSystemStore } from './systemStore';

interface NetworkState {
  isOnline: boolean;
  lastChangedAt: number | null;

  /** Update connectivity state. Deduplicates — only updates if value differs. */
  setOnline: (online: boolean) => void;
}

export const useNetworkStore = create<NetworkState>()((set, get) => ({
  isOnline: false,
  lastChangedAt: null,

  setOnline: (online: boolean) => {
    if (get().isOnline === online) {
      return;
    }

    set({ isOnline: online, lastChangedAt: Date.now() });

    // Backward compatibility: keep useSystemStore.isOffline in sync
    useSystemStore.getState().setOffline(!online);
  },
}));
