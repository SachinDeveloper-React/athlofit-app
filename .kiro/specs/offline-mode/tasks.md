# Implementation Plan: Offline Mode

## Overview

Implement offline-first behavior for Athlofit's health tracking screens. The implementation adds a ConnectivityMonitor (NetInfo + debounce), a Zustand network store, an MMKV-backed OfflineQueue, a SyncEngine for draining queued mutations on reconnection, and an OfflineBanner for non-health screens. Existing hydration and background sync flows are modified to enqueue mutations when offline instead of calling the server.

## Tasks

- [x] 1. Create useNetworkStore and ConnectivityMonitor
  - [x] 1.1 Create useNetworkStore Zustand store
    - Create `src/store/networkStore.ts` with `isOnline`, `lastChangedAt`, and `setOnline` action
    - `setOnline` deduplicates (only updates if value differs), updates `lastChangedAt`, and calls `useSystemStore.getState().setOffline(!online)` for backward compatibility
    - No MMKV persistence — state is derived from NetInfo on each launch
    - _Requirements: 1.3_

  - [x] 1.2 Create ConnectivityMonitor singleton service
    - Create `src/services/connectivityMonitor.ts` implementing `initialize()` and `destroy()`
    - On `initialize()`: call `NetInfo.fetch()` for initial state, map `null`/`unknown` to offline, set store, then subscribe to `NetInfo.addEventListener`
    - Implement 3-second debounce window: buffer rapid state changes, commit only the final stable value after stabilization period
    - Call `useNetworkStore.getState().setOnline(value)` with debounced result
    - Call `onlineManager.setOnline(value)` from `@tanstack/react-query` to pause/resume queries
    - Emit state change only once per transition regardless of underlying events
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 1.3 Write property test for debounce stabilization
    - **Property 1: Debounce stabilization produces final state**
    - **Validates: Requirements 1.6, 1.7**

  - [ ]* 1.4 Write unit tests for useNetworkStore and ConnectivityMonitor
    - Test state deduplication (setting same value doesn't trigger update)
    - Test backward compat with useSystemStore.setOffline
    - Test initialization with null/unknown NetInfo states maps to offline
    - Test subscription cleanup on destroy()
    - _Requirements: 1.3, 1.4, 1.5_

- [x] 2. Implement OfflineQueue
  - [x] 2.1 Create OfflineQueue service
    - Create `src/services/offlineQueue.ts` implementing the `OfflineQueue` interface from design
    - Use existing `mmkv` instance from `src/store/index.ts`
    - Storage keys: `offline-queue:entries` (JSON array of QueueEntry[]), `offline-queue:dead-letter` (JSON array of DeadLetterEntry[], max 50)
    - Implement `enqueue()`: generate unique ID (`queue_${Date.now()}_${random}`), enforce 500-entry cap (discard oldest on overflow), persist within 1 second
    - Implement `getAll()`: return entries sorted by timestamp ascending (oldest first)
    - Implement `remove(id)`: remove specific entry after successful sync
    - Implement `size()`: return current queue length
    - Implement `moveToDeadLetter()`: move failed entry with statusCode and errorMessage, enforce 50-entry cap
    - Implement `getDeadLetterEntries()` and `clear()`
    - On MMKV write failure: retry once, then hold in memory for current session and log warning
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 2.2 Write property test for queue persistence round-trip
    - **Property 2: Queue entry persistence round-trip**
    - **Validates: Requirements 3.3, 3.5**

  - [ ]* 2.3 Write property test for queue chronological ordering
    - **Property 3: Queue chronological ordering invariant**
    - **Validates: Requirements 3.2, 7.4**

  - [ ]* 2.4 Write property test for queue size cap
    - **Property 4: Queue size cap invariant**
    - **Validates: Requirements 3.4**

- [x] 3. Implement SyncEngine
  - [x] 3.1 Create SyncEngine singleton service
    - Create `src/services/syncEngine.ts` implementing `drain()`, `isProcessing`, and `onDrainComplete()`
    - Implement mutex lock: if `drain()` called while already processing, return immediately
    - Process entries oldest-first, max 100 per drain session
    - Retry logic for 5xx: up to 3 retries with exponential backoff (2s, 4s, 8s)
    - Client error (4xx): move to dead-letter via `offlineQueue.moveToDeadLetter()`, continue next
    - Check `useNetworkStore.getState().isOnline` before each request; if offline, halt and preserve remaining entries
    - Post-drain: invalidate React Query caches (`weekly-steps`, `streaks`, `coin-data`, `gamification`, `challenges`, `hydration`)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [x] 3.2 Wire SyncEngine trigger via Zustand subscription
    - Subscribe to `useNetworkStore` state changes
    - When `isOnline` transitions from `false` to `true`, call `syncEngine.drain()` within 5 seconds
    - Ensure subscription is set up during app initialization (in ConnectivityMonitor.initialize or App.tsx)
    - _Requirements: 4.1, 4.7_

  - [ ]* 3.3 Write property test for sync engine ordered drain with batch cap
    - **Property 5: Sync engine ordered drain with batch cap**
    - **Validates: Requirements 4.2**

  - [ ]* 3.4 Write property test for error classification and dead-letter management
    - **Property 6: Error classification and dead-letter management**
    - **Validates: Requirements 4.4, 4.5**

  - [ ]* 3.5 Write property test for sync mutex
    - **Property 7: Sync mutex prevents concurrent execution**
    - **Validates: Requirements 4.7**

  - [ ]* 3.6 Write property test for mid-drain offline halt
    - **Property 8: Mid-drain offline halts and preserves remaining**
    - **Validates: Requirements 4.8**

- [x] 4. Checkpoint - Core services complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Integrate offline queueing into hydration and background sync
  - [x] 5.1 Modify hydrationStore.addWater() for offline path
    - In `src/features/health/store/hydrationStore.ts`, import `useNetworkStore` and `offlineQueue`
    - Before server call, check `useNetworkStore.getState().isOnline`
    - If offline: enqueue hydration sync payload (`{ endpoint: 'health/sync', method: 'POST', payload: { hydration: { amount, timestamp, dailyTotal } }, actionType: 'hydration_sync' }`) and return without calling server (keep optimistic state, no rollback)
    - If online: existing behavior unchanged (optimistic update → server call → rollback on failure)
    - _Requirements: 6.1, 6.2, 6.5_

  - [x] 5.2 Modify backgroundSync.service.ts for offline queueing
    - In `src/features/health/service/backgroundSync.service.ts`, import `useNetworkStore` and `offlineQueue`
    - In `postSync()` or before calling it: check `useNetworkStore.getState().isOnline`
    - If offline: enqueue the sync payload to OfflineQueue with `actionType: 'health_sync'`, suppress error notifications, return null
    - If online: existing behavior unchanged
    - Ensure new payloads append without overwriting existing queue entries
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 5.3 Write property test for offline hydration enqueue
    - **Property 10: Offline hydration enqueue completeness**
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 5.4 Write property test for background sync enqueue when offline
    - **Property 11: Background sync enqueues when offline**
    - **Validates: Requirements 7.1**

  - [ ]* 5.5 Write property test for successful sync removes entry
    - **Property 9: Successful sync removes entry from queue**
    - **Validates: Requirements 6.4**

- [x] 6. Implement OfflineBanner and integrate into Online Screens
  - [x] 6.1 Create OfflineBanner component
    - Create `src/components/OfflineBanner.tsx`
    - Read `isOnline` from `useNetworkStore`
    - When offline: render banner with Wi-Fi-off icon (minimum 24×24 dp) and text "No internet connection"
    - Position at top of content area, below navigation header
    - Use `Animated` opacity/height for smooth show/hide transitions
    - Fixed-height container that pushes content down (does not obstruct scrolling)
    - Theme-aware via `useTheme()` hook (dark/light mode)
    - Dismiss within 3 seconds of connectivity restoration (driven by store state)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 6.2 Add OfflineBanner to Online Screens
    - Add `<OfflineBanner />` to Shop screens, LeaderboardScreen, and ChallengesScreen
    - Ensure cached content displays below the banner when offline (existing React Query cache)
    - If no cached content exists, show centered empty-state message: "Content unavailable offline. Will load when connected."
    - _Requirements: 5.1, 5.6, 5.7_

  - [ ]* 6.3 Write unit tests for OfflineBanner
    - Test renders when offline, hides when online
    - Test correct text and icon presence
    - Test does not render on health screens
    - _Requirements: 5.2, 5.3, 5.4_

- [x] 7. Suppress errors on Health Screens and wire React Query onlineManager
  - [x] 7.1 Integrate React Query onlineManager in app initialization
    - In `src/app/App.tsx`, import `onlineManager` from `@tanstack/react-query`
    - ConnectivityMonitor already calls `onlineManager.setOnline()` — verify wiring is correct
    - Ensure queries pause when offline and resume on reconnection
    - _Requirements: 2.1, 2.3_

  - [x] 7.2 Suppress network error toasts on Health Screens when offline
    - In TrackerScreen, HydrationScreen, StepDetailScreen, HeartRateScreen, BloodPressureScreen: suppress error toasts and loading indicators when `useNetworkStore.isOnline` is false
    - Health screens render from cached data (MMKV-persisted stores, React Query cache, Health Connect sensor data)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 7.3 Write unit tests for health screen offline behavior
    - Test TrackerScreen renders cached metrics without error states when offline
    - Test HydrationScreen allows adding water when offline
    - Test error toasts are suppressed when offline
    - _Requirements: 2.3, 2.7_

- [x] 8. Wire ConnectivityMonitor initialization in app startup
  - [x] 8.1 Initialize ConnectivityMonitor before navigation renders
    - In `src/app/App.tsx` (or app initialization flow), call `connectivityMonitor.initialize()` before the root navigation tree renders
    - Ensure initial state is set (offline if no connectivity or indeterminate) before any screen mounts
    - Set up SyncEngine Zustand subscription during initialization
    - _Requirements: 1.4, 1.5, 4.1_

- [x] 9. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript throughout, matching the existing codebase
- All services reuse the existing MMKV instance from `src/store/index.ts`
- `@react-native-community/netinfo` is already installed — no new dependencies needed
- `fast-check` should be added as a dev dependency for property-based tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["1.4", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "3.5", "3.6"] },
    { "id": 4, "tasks": ["5.1", "5.2", "6.1"] },
    { "id": 5, "tasks": ["5.3", "5.4", "5.5", "6.2", "6.3"] },
    { "id": 6, "tasks": ["7.1", "7.2", "8.1"] },
    { "id": 7, "tasks": ["7.3"] }
  ]
}
```
