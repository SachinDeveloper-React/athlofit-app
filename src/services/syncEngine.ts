// src/services/syncEngine.ts
//
// Singleton service that drains the OfflineQueue when connectivity is restored.
// Uses a mutex to prevent concurrent drains and processes entries oldest-first.

import { QueryClient } from '@tanstack/react-query';
import { offlineQueue, QueueEntry } from './offlineQueue';
import { useNetworkStore } from '../store/networkStore';
import { api } from '../utils/api';

// --- Constants ---

const MAX_ENTRIES_PER_DRAIN = 100;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 2000;

// React Query cache keys to invalidate after a successful drain
const CACHE_KEYS_TO_INVALIDATE = [
  'weekly-steps',
  'streaks',
  'coin-data',
  'gamification',
  'challenges',
  'hydration',
];

// --- Helpers ---

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getStatusCode(error: unknown): number {
  if (
    error != null &&
    typeof error === 'object' &&
    'statusCode' in error &&
    typeof (error as any).statusCode === 'number'
  ) {
    return (error as any).statusCode;
  }
  return 0;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// --- SyncEngine Singleton ---

export const syncEngine = (() => {
  let _isProcessing = false;
  let _queryClient: QueryClient | null = null;
  const _drainCompleteCallbacks: Set<() => void> = new Set();

  /**
   * Provide the app's QueryClient instance. Call during app initialization.
   */
  function setQueryClient(client: QueryClient): void {
    _queryClient = client;
  }

  /**
   * Whether a drain is currently in progress.
   */
  function getIsProcessing(): boolean {
    return _isProcessing;
  }

  /**
   * Subscribe to drain completion events.
   * Returns an unsubscribe function.
   */
  function onDrainComplete(callback: () => void): () => void {
    _drainCompleteCallbacks.add(callback);
    return () => {
      _drainCompleteCallbacks.delete(callback);
    };
  }

  /**
   * Execute the HTTP request for a queue entry using the api utility.
   */
  async function executeRequest(entry: QueueEntry): Promise<void> {
    const { endpoint, method, payload } = entry;

    switch (method) {
      case 'POST':
        await api.post(endpoint, payload);
        break;
      case 'PUT':
        await api.put(endpoint, payload);
        break;
      case 'PATCH':
        await api.patch(endpoint, payload);
        break;
      case 'DELETE':
        await api.delete(endpoint);
        break;
    }
  }

  /**
   * Process a single queue entry with retry logic for 5xx errors.
   * Returns true if the entry was handled (success or moved to dead-letter),
   * or false if processing should halt (device went offline).
   */
  async function processEntry(entry: QueueEntry): Promise<boolean> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // Check connectivity before each request attempt
      if (!useNetworkStore.getState().isOnline) {
        return false; // Halt — device went offline
      }

      try {
        await executeRequest(entry);
        // Success (2xx) — remove from queue
        offlineQueue.remove(entry.id);
        return true;
      } catch (error: unknown) {
        lastError = error;
        const statusCode = getStatusCode(error);

        // 4xx client error — move to dead-letter immediately, continue
        if (statusCode >= 400 && statusCode < 500) {
          offlineQueue.moveToDeadLetter(entry, statusCode, getErrorMessage(error));
          return true;
        }

        // 5xx server error — retry with exponential backoff
        if (statusCode >= 500 && statusCode < 600) {
          if (attempt < MAX_RETRIES) {
            const backoffMs = BASE_BACKOFF_MS * Math.pow(2, attempt);
            await delay(backoffMs);
            continue;
          }
          // Exhausted retries — move to dead-letter
          offlineQueue.moveToDeadLetter(entry, statusCode, getErrorMessage(error));
          return true;
        }

        // Unknown error (network error, no status code, etc.)
        // Treat as transient — if we can't determine the status, halt to be safe
        // This preserves the entry in the queue for the next drain
        return false;
      }
    }

    // Should not reach here, but if it does, move to dead-letter
    const statusCode = getStatusCode(lastError);
    offlineQueue.moveToDeadLetter(
      entry,
      statusCode || 500,
      getErrorMessage(lastError),
    );
    return true;
  }

  /**
   * Invalidate React Query caches after a successful drain.
   */
  function invalidateCaches(): void {
    if (_queryClient == null) {
      return;
    }

    for (const key of CACHE_KEYS_TO_INVALIDATE) {
      _queryClient.invalidateQueries({ queryKey: [key] });
    }
  }

  /**
   * Notify all drain-complete subscribers.
   */
  function notifyDrainComplete(): void {
    for (const callback of _drainCompleteCallbacks) {
      try {
        callback();
      } catch {
        // Swallow errors from callbacks to prevent one bad listener from
        // breaking the notification chain.
      }
    }
  }

  /**
   * Attempt to drain the offline queue.
   * No-op if already running or if the device is offline.
   */
  async function drain(): Promise<void> {
    // Mutex: prevent concurrent drains
    if (_isProcessing) {
      return;
    }

    // Don't start if offline
    if (!useNetworkStore.getState().isOnline) {
      return;
    }

    _isProcessing = true;

    try {
      // Get entries (oldest first), capped at 100
      const entries = offlineQueue.getAll().slice(0, MAX_ENTRIES_PER_DRAIN);

      for (const entry of entries) {
        const handled = await processEntry(entry);
        if (!handled) {
          // Device went offline or unrecoverable network issue — halt
          break;
        }
      }

      // Post-drain: invalidate caches so screens refresh with server data
      invalidateCaches();
    } finally {
      _isProcessing = false;
      notifyDrainComplete();
    }
  }

  return {
    drain,
    get isProcessing() {
      return getIsProcessing();
    },
    onDrainComplete,
    setQueryClient,
  };
})();
