// ─── Hydration Service (Backend API) ─────────────────────────────────────────
// Handles all REST calls for hydration history persistence

import { HistoryEntry } from '../types/hydration.type';
import { BASE_URL as API_BASE_URL } from '../../../utils/api';

// Strip trailing slash so we can append paths cleanly
const BASE_URL = API_BASE_URL.replace(/\/$/, '');

export const hydrationService = {
  /**
   * Fetch today's hydration history from backend
   */
  async fetchTodayHistory(authToken: string): Promise<HistoryEntry[]> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const res = await fetch(`${BASE_URL}/health/history?from=${today}&to=${today}&limit=1`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch hydration history: ${res.status}`);
    }

    const data: { data: { hydration?: number; date: string }[] } = await res.json();
    // Backend returns daily aggregates — convert to HistoryEntry format
    const records = data.data ?? [];
    return records
      .filter(r => r.date === today && (r.hydration ?? 0) > 0)
      .map(r => ({
        id: `server-${r.date}`,
        amount: r.hydration ?? 0,
        time: new Date(`${r.date}T00:00:00`),
        source: 'manual' as const,
      }));
  },

  /**
   * Log a water intake entry to backend via health sync
   */
  async logWaterIntake(
    authToken: string,
    amount: number,
    source: HistoryEntry['source'] = 'manual',
  ): Promise<HistoryEntry> {
    const today = new Date().toISOString().split('T')[0];

    const res = await fetch(`${BASE_URL}/health/sync`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        date: today,
        hydration: amount,
        goalMet: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to log water intake: ${res.status}`);
    }

    return {
      id: `server-${Date.now()}`,
      amount,
      time: new Date(),
      source,
    };
  },

  /**
   * Reset today's hydration data on backend
   */
  async resetToday(authToken: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const res = await fetch(`${BASE_URL}/health/sync`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        date: today,
        hydration: 0,
        goalMet: false,
      }),
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

    const today = new Date().toISOString().split('T')[0];
    const totalHydration = entries.reduce((sum, e) => sum + e.amount, 0);

    const res = await fetch(`${BASE_URL}/health/sync`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        date: today,
        hydration: totalHydration,
        goalMet: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to sync health entries: ${res.status}`);
    }
  },
};
