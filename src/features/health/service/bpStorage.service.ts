import { createMMKV } from 'react-native-mmkv';
import type { BPReading } from '../types/bloodpressure.types';

const storage = createMMKV();
const STORAGE_KEY = '@bp_readings';

export const BPStorageService = {
  save(readings: BPReading[]): void {
    const serialized = readings.map(r => ({
      ...r,
      timestamp: r.timestamp.toISOString(),
    }));
    storage.set(STORAGE_KEY, JSON.stringify(serialized));
  },

  load(): BPReading[] {
    const raw = storage.getString(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((r: any) => ({
      ...r,
      timestamp: new Date(r.timestamp),
    }));
  },
};
