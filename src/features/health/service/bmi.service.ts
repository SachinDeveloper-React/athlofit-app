// src/features/health/service/bmi.service.ts
// ─── BMI API layer ─────────────────────────────────────────────────────────────
// The api utility returns the full JSON envelope: { success, message, data }

import { api } from '../../../utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BmiRecord {
  _id: string;
  date: string;           // YYYY-MM-DD
  weight: number;         // kg
  height: number;         // m
  bmi: number;
  category: 'underweight' | 'normal' | 'overweight' | 'obese';
  createdAt: string;
}

export interface SaveBmiPayload {
  weight: number;   // kg
  height: number;   // m (e.g. 1.75)
}

interface ApiEnvelope<D> { success: boolean; message: string; data: D }

// ─── Service ──────────────────────────────────────────────────────────────────

export const bmiService = {
  /** POST /health/bmi — compute + persist a new BMI reading */
  save: async (payload: SaveBmiPayload): Promise<BmiRecord> => {
    const res = await api.post<ApiEnvelope<BmiRecord>>('health/bmi', payload);
    return res.data;
  },

  /** GET /health/bmi?limit=N — most recent readings, newest-first */
  getHistory: async (limit = 10): Promise<BmiRecord[]> => {
    const res = await api.get<ApiEnvelope<BmiRecord[]>>(`health/bmi?limit=${limit}`);
    return res.data ?? [];
  },
};
