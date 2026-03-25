// ─── Hydration Service (Backend API) ─────────────────────────────────────────
// Handles all REST calls for hydration history persistence

import { HistoryEntry } from '../types/hydration.type';

const BASE_URL = 'https://api.yourapp.com';

interface ApiHistoryEntry {
  id: string;
  amount_ml: number;
  recorded_at: string; // ISO string
  source: 'manual' | 'health_connect' | 'healthkit';
}

const toHistoryEntry = (raw: ApiHistoryEntry): HistoryEntry => ({
  id: raw.id,
  amount: raw.amount_ml,
  time: new Date(raw.recorded_at),
  source: raw.source,
});

export const hydrationService = {
  /**
   * Fetch today's hydration history from backend
   */
  async fetchTodayHistory(authToken: string): Promise<HistoryEntry[]> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const res = await fetch(`${BASE_URL}/v1/hydration/history?date=${today}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch hydration history: ${res.status}`);
    }

    const data: { entries: ApiHistoryEntry[] } = await res.json();
    return data.entries.map(toHistoryEntry);
  },

  /**
   * Log a water intake entry to backend
   */
  async logWaterIntake(
    authToken: string,
    amount: number,
    source: HistoryEntry['source'] = 'manual',
  ): Promise<HistoryEntry> {
    const res = await fetch(`${BASE_URL}/v1/hydration/log`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount_ml: amount,
        recorded_at: new Date().toISOString(),
        source,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to log water intake: ${res.status}`);
    }

    const data: { entry: ApiHistoryEntry } = await res.json();
    return toHistoryEntry(data.entry);
  },

  /**
   * Reset today's hydration data on backend
   */
  async resetToday(authToken: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const res = await fetch(`${BASE_URL}/v1/hydration/reset?date=${today}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to reset hydration: ${res.status}`);
    }
  },

  /**
   * Sync entries from health platform to backend (upsert)
   */
  async syncHealthEntries(
    authToken: string,
    entries: Omit<HistoryEntry, 'id'>[],
  ): Promise<void> {
    if (entries.length === 0) return;

    const res = await fetch(`${BASE_URL}/v1/hydration/sync`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entries: entries.map(e => ({
          amount_ml: e.amount,
          recorded_at: e.time.toISOString(),
          source: e.source,
        })),
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to sync health entries: ${res.status}`);
    }
  },
};
