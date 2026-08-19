// ─── Hydration Service (Backend API) ─────────────────────────────────────────
// Handles all REST calls for hydration history persistence

import { HistoryEntry } from '../types/hydration.type';
import { BASE_URL as API_BASE_URL } from '../../../utils/api';
import { getLocalToday } from '../../../utils/date';
import { getTimezone } from '../../../utils/timezone';

// Strip trailing slash so we can append paths cleanly
const BASE_URL = API_BASE_URL.replace(/\/$/, '');

/**
 * Fields every POST /health/sync body from this file carries.
 *
 * These calls post to the same endpoint the step sync uses, and they used to omit
 * `timezone` and send a hardcoded `goalMet: false`. Both mattered:
 *
 *  - Without `timezone` the server resolves "today" from a hardcoded Asia/Kolkata
 *    fallback while `date` below is the device's local day. For any user outside
 *    IST the two disagree for part of every day, `isTodaySync` comes out false,
 *    and a plain water log is routed into the retroactive-award branch.
 *  - `goalMet: false` was read by the server with `??`, which does not fall
 *    through on `false`, so logging a glass of water reset that day's goalMet flag
 *    even when the step goal had already been reached. The field is now omitted
 *    entirely: these payloads carry no steps and have no business voting on it.
 */
const syncEnvelope = () => ({
  date: getLocalToday(),
  timezone: getTimezone(),
});

export const hydrationService = {
  /**
   * Fetch today's hydration history from backend
   */
  async fetchTodayHistory(authToken: string): Promise<HistoryEntry[]> {
    const today = getLocalToday(); // YYYY-MM-DD

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
    const res = await fetch(`${BASE_URL}/health/sync`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...syncEnvelope(),
        hydration: amount,
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
    const res = await fetch(`${BASE_URL}/health/sync`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...syncEnvelope(),
        hydration: 0,
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

    const totalHydration = entries.reduce((sum, e) => sum + e.amount, 0);

    const res = await fetch(`${BASE_URL}/health/sync`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...syncEnvelope(),
        hydration: totalHydration,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to sync health entries: ${res.status}`);
    }
  },
};
