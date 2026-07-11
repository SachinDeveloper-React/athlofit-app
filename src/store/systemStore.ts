import { create } from 'zustand';

interface ForceUpdateInfo {
  updateType: 'force' | 'soft';
  title: string;
  message: string;
  latestVersion: string;
  updateUrl: string;
}

interface SystemState {
  isMaintenance: boolean;
  isOffline: boolean;
  isServerUnreachable: boolean;
  forceUpdate: ForceUpdateInfo | null;
  setMaintenance: (status: boolean) => void;
  setOffline: (status: boolean) => void;
  setServerUnreachable: (status: boolean) => void;
  setForceUpdate: (info: ForceUpdateInfo | null) => void;
}

export const useSystemStore = create<SystemState>()((set) => ({
  isMaintenance: false,
  isOffline: false,
  isServerUnreachable: false,
  forceUpdate: null,
  setMaintenance: (status) => set({ isMaintenance: status }),
  setOffline: (status) => set({ isOffline: status }),
  setServerUnreachable: (status) => set({ isServerUnreachable: status }),
  setForceUpdate: (info) => set({ forceUpdate: info }),
}));
