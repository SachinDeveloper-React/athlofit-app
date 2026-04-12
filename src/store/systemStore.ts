import { create } from 'zustand';

interface SystemState {
  isMaintenance: boolean;
  isOffline: boolean;
  setMaintenance: (status: boolean) => void;
  setOffline: (status: boolean) => void;
}

export const useSystemStore = create<SystemState>()((set) => ({
  isMaintenance: false,
  isOffline: false,
  setMaintenance: (status) => set({ isMaintenance: status }),
  setOffline: (status) => set({ isOffline: status }),
}));
