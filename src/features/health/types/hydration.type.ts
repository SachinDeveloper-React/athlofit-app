export type DrinkSize = 100 | 200 | 500;

export interface HistoryEntry {
  id: string;
  amount: number; // in ml
  time: Date;
  source: 'manual' | 'health_connect' | 'healthkit';
}

export interface HydrationState {
  consumed: number; // ml consumed today
  dailyGoal: number; // ml goal
  history: HistoryEntry[];
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  lastResetDate: string | null;
}

export interface HydrationActions {
  addWater: (amount: DrinkSize) => Promise<void>;
  resetDay: () => Promise<void>;
  setHistory: (entries: HistoryEntry[]) => void;
  setConsumed: (amount: number) => void;
  setLoading: (loading: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setError: (error: string | null) => void;
  fetchHistory: () => Promise<void>;
  checkAndResetIfNewDay: () => void;
}

export type HydrationStore = HydrationState & HydrationActions;

// Health platform types
export interface HealthWaterSample {
  uuid: string;
  startDate: string;
  endDate: string;
  quantity: number; // ml
  sourceName?: string;
}

export interface HealthConnectPermission {
  accessType: 'read' | 'write';
  recordType: string;
}
