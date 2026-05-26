// src/services/offlineQueue.ts
import { mmkv } from '../store/index';

// --- Types ---

export interface QueueEntry {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payload: Record<string, unknown>;
  timestamp: string; // ISO 8601
  actionType: 'hydration_sync' | 'health_sync' | 'general';
}

export interface DeadLetterEntry {
  originalEntry: QueueEntry;
  failedAt: string; // ISO 8601
  statusCode: number;
  errorMessage: string;
}

// --- Constants ---

const STORAGE_KEY_ENTRIES = 'offline-queue:entries';
const STORAGE_KEY_DEAD_LETTER = 'offline-queue:dead-letter';
const MAX_QUEUE_SIZE = 500;
const MAX_DEAD_LETTER_SIZE = 50;

// --- OfflineQueue Singleton ---

class OfflineQueueService {
  private memoryEntries: QueueEntry[] | null = null;
  private memoryDeadLetter: DeadLetterEntry[] | null = null;
  private persistenceFailed = false;

  /**
   * Add an action to the queue. Enforces 500-entry cap.
   * Generates a unique ID and persists within 1 second.
   */
  enqueue(entry: Omit<QueueEntry, 'id'>): QueueEntry {
    const id = `queue_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const newEntry: QueueEntry = { ...entry, id };

    const entries = this.loadEntries();
    entries.push(newEntry);

    // Enforce 500-entry cap: discard oldest on overflow
    while (entries.length > MAX_QUEUE_SIZE) {
      entries.shift();
    }

    // Sort by timestamp ascending
    entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    this.persistEntries(entries);
    return newEntry;
  }

  /**
   * Retrieve all entries in chronological order (oldest first).
   */
  getAll(): QueueEntry[] {
    const entries = this.loadEntries();
    return entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Remove a specific entry by ID after successful sync.
   */
  remove(id: string): void {
    const entries = this.loadEntries();
    const filtered = entries.filter(e => e.id !== id);
    this.persistEntries(filtered);
  }

  /**
   * Get current queue size.
   */
  size(): number {
    return this.loadEntries().length;
  }

  /**
   * Move a failed entry to the dead-letter section.
   * Enforces 50-entry cap (discards oldest on overflow).
   */
  moveToDeadLetter(
    entry: QueueEntry,
    statusCode: number,
    errorMessage: string,
  ): void {
    // Remove from main queue
    this.remove(entry.id);

    const deadLetter = this.loadDeadLetter();
    const deadLetterEntry: DeadLetterEntry = {
      originalEntry: entry,
      failedAt: new Date().toISOString(),
      statusCode,
      errorMessage,
    };

    deadLetter.push(deadLetterEntry);

    // Enforce 50-entry cap: discard oldest on overflow
    while (deadLetter.length > MAX_DEAD_LETTER_SIZE) {
      deadLetter.shift();
    }

    this.persistDeadLetter(deadLetter);
  }

  /**
   * Get dead-letter entries.
   */
  getDeadLetterEntries(): DeadLetterEntry[] {
    return this.loadDeadLetter();
  }

  /**
   * Clear the entire queue and dead-letter (for testing / logout).
   */
  clear(): void {
    this.memoryEntries = null;
    this.memoryDeadLetter = null;
    this.persistenceFailed = false;

    try {
      mmkv.remove(STORAGE_KEY_ENTRIES);
      mmkv.remove(STORAGE_KEY_DEAD_LETTER);
    } catch {
      // Best effort cleanup
    }
  }

  // --- Private helpers ---

  private loadEntries(): QueueEntry[] {
    if (this.persistenceFailed && this.memoryEntries !== null) {
      return [...this.memoryEntries];
    }

    try {
      const raw = mmkv.getString(STORAGE_KEY_ENTRIES);
      if (!raw) {
        return [];
      }
      return JSON.parse(raw) as QueueEntry[];
    } catch {
      return this.memoryEntries ? [...this.memoryEntries] : [];
    }
  }

  private persistEntries(entries: QueueEntry[]): void {
    this.memoryEntries = entries;

    const json = JSON.stringify(entries);

    try {
      mmkv.set(STORAGE_KEY_ENTRIES, json);
      this.persistenceFailed = false;
    } catch {
      // Retry once on MMKV write failure
      try {
        mmkv.set(STORAGE_KEY_ENTRIES, json);
        this.persistenceFailed = false;
      } catch {
        // Hold in memory for current session and log warning
        this.persistenceFailed = true;
        console.warn(
          '[OfflineQueue] MMKV write failed after retry. Holding entries in memory for this session.',
        );
      }
    }
  }

  private loadDeadLetter(): DeadLetterEntry[] {
    if (this.persistenceFailed && this.memoryDeadLetter !== null) {
      return [...this.memoryDeadLetter];
    }

    try {
      const raw = mmkv.getString(STORAGE_KEY_DEAD_LETTER);
      if (!raw) {
        return [];
      }
      return JSON.parse(raw) as DeadLetterEntry[];
    } catch {
      return this.memoryDeadLetter ? [...this.memoryDeadLetter] : [];
    }
  }

  private persistDeadLetter(entries: DeadLetterEntry[]): void {
    this.memoryDeadLetter = entries;

    const json = JSON.stringify(entries);

    try {
      mmkv.set(STORAGE_KEY_DEAD_LETTER, json);
    } catch {
      // Retry once
      try {
        mmkv.set(STORAGE_KEY_DEAD_LETTER, json);
      } catch {
        this.persistenceFailed = true;
        console.warn(
          '[OfflineQueue] MMKV dead-letter write failed after retry. Holding in memory for this session.',
        );
      }
    }
  }
}

export const offlineQueue = new OfflineQueueService();
