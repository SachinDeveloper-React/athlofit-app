import { create } from 'zustand';

interface SystemState {
  isMaintenance: boolean;
  isOffline: boolean;
  isServerUnreachable: boolean;
  setMaintenance: (status: boolean) => void;
  setOffline: (status: boolean) => void;
  setServerUnreachable: (status: boolean) => void;
}

export const useSystemStore = create<SystemState>()((set) => ({
  isMaintenance: false,
  isOffline: false,
  isServerUnreachable: false,
  setMaintenance: (status) => set({ isMaintenance: status }),
  setOffline: (status) => set({ isOffline: status }),
  setServerUnreachable: (status) => set({ isServerUnreachable: status }),
}));
