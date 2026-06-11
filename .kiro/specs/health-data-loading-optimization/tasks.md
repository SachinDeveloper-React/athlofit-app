# Implementation Plan

## Overview

Fix the TrackerScreen cold-start performance bug by persisting HealthData in MMKV, hydrating useHealth from cache on mount, replacing the blocking full-screen loader with cached data + skeleton placeholders, and deduplicating overlapping refresh triggers with a 30-second staleness guard.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Full-Screen Loader on Cold Start Without Cache
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to app launch states where `healthDataStore.persistedHealthData = null AND isAppOpening = true`
  - Test that when the app opens with no cached HealthData in MMKV, `useHealth` initializes with `defaultHealthData` (all zeros) and `isLoading: true`, causing TrackerScreen to render a full-screen `<Loader>`
  - Property assertion (expected behavior after fix): For all app launches where MMKV has previously persisted HealthData, `useHealth` SHALL hydrate from cache (non-zero values), set `isLoading: false` initially, and TrackerScreen SHALL NOT render the full-screen `<Loader>` — instead showing cached data with skeleton placeholders for loading sections
  - Test file: `src/features/health/__tests__/bugCondition.property.test.ts`
  - Mock `mmkvStorage` to simulate empty persisted state, mount `useHealth` hook, assert initial state is zeros and `isLoading` is true
  - Mock `mmkvStorage` with previously persisted HealthData, mount `useHealth` hook, assert initial state matches cached values and `isLoading` is false
  - Verify TrackerScreen renders `<Loader>` when no cache exists (current buggy behavior)
  - Verify that multiple refresh triggers fire concurrently on mount (useFocusEffect + AppState + useEffect) — assert `loadData` is called 2+ times
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (the hydration assertions fail because `useHealth` always starts with zeros and `isLoading: true` regardless of MMKV state, and no deduplication exists)
  - Document counterexamples: e.g., "useHealth starts with steps=0 even though MMKV contains {steps: 4230, ...}" and "loadData called 3 times on single mount"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Refresh and Sync Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code: `handleRefresh()` (pull-to-refresh) calls `refresh()` without silent flag, triggering `loadData` with `silent=false` and showing loading spinner — always fetches fresh data regardless of timing
  - Observe on UNFIXED code: Auto-refresh interval (60s) calls `loadData(platform, true)` silently — no loading state shown to user
  - Observe on UNFIXED code: `syncHealth` is called with 5-min / 10-step throttle when `data`, `isReady`, `lastUpdated` change
  - Observe on UNFIXED code: `healthDataStore.reset()` clears all state back to defaults on logout
  - Observe on UNFIXED code: When `platform === 'unavailable'`, PermissionDeniedScreen renders
  - Observe on UNFIXED code: When `stepService.getSource() === 'native_sensor'`, native step count overrides fetched steps
  - Test file: `src/features/health/__tests__/preservation.property.test.ts`
  - Write property-based test: For all non-bug-condition inputs (pull-to-refresh calls), `refresh()` with no `silent` flag always calls `loadData` and sets `isLoading: true` — behavior unchanged by fix
  - Write property-based test: For all auto-refresh timer callbacks, `loadData` is called with `silent=true` and `isLoading` is NOT set to `true` — behavior unchanged
  - Write property-based test: For all `syncHealth` triggers, the 5-min / 10-step throttle logic produces identical sync/no-sync decisions before and after fix
  - Write property-based test: `healthDataStore.reset()` always clears `data` to `defaultHealthData`, `lastUpdated` to `null`, and `loginTimestamp` to `null`
  - Write property-based test: Permission-denied flows still render `PermissionDeniedScreen` when `platform === 'unavailable'`
  - Write property-based test: Native step counter fallback still overrides step count in `loadData` result
  - Verify ALL tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix for health data loading optimization

  - [x] 3.1 Expand `healthDataStore.ts` persistence to include full HealthData
    - Update `partialize` to persist `data`, `lastUpdated`, and `loginTimestamp` fields to MMKV
    - Add `lastFetchedAt: number | null` field to the store interface and initial state
    - Add `setLastFetchedAt: (timestamp: number) => void` action
    - Include `lastFetchedAt` in `partialize` so it persists across restarts
    - Update `reset()` to also clear `lastFetchedAt`
    - _Bug_Condition: isBugCondition(X) where X.hasCachedHealthData = false AND X.isAppOpening = true_
    - _Expected_Behavior: Persisted HealthData available in MMKV on next launch so useHealth can hydrate from cache_
    - _Preservation: reset() must still clear all data on logout (Requirement 3.4)_
    - _Requirements: 1.2, 2.1, 2.2, 3.4_

  - [x] 3.2 Add cache hydration and deduplication to `useHealth.ts`
    - Hydrate initial `data` state from `useHealthDataStore.getState().data` (fallback to `defaultHealthData` if null)
    - Hydrate initial `lastUpdated` from `useHealthDataStore.getState().lastUpdated`
    - Set `isLoading: false` initially if cached data exists (i.e., `cachedData !== null && cachedData !== defaultHealthData`)
    - Persist data to `healthDataStore` on every successful `loadData` completion: call `useHealthDataStore.getState().setData(result)` and `useHealthDataStore.getState().setLastFetchedAt(Date.now())`
    - Add `lastFetchedAtRef = useRef<number>(useHealthDataStore.getState().lastFetchedAt ?? 0)` to track fetch timestamps within the hook
    - Add `STALE_THRESHOLD_MS = 30_000` constant
    - Add staleness guard to `refresh()`: if `Date.now() - lastFetchedAtRef.current < STALE_THRESHOLD_MS` AND `silent === true`, skip the fetch (pull-to-refresh with `silent=false` always executes)
    - Add `isSettingUpRef = useRef(false)` guard to `setup()`: if already setting up, return early to prevent concurrent setup calls
    - Update `lastFetchedAtRef.current = Date.now()` after each successful `loadData`
    - _Bug_Condition: useHealth always starts with defaultHealthData zeros and isLoading=true, no deduplication_
    - _Expected_Behavior: useHealth hydrates from MMKV cache, isLoading=false if cache exists, staleness guard prevents redundant fetches within 30s_
    - _Preservation: Pull-to-refresh (silent=false) always forces fetch (Requirement 3.1); auto-refresh timer still calls loadData silently (Requirement 3.7); native step counter fallback unaffected (Requirement 3.6)_
    - _Requirements: 1.2, 1.3, 1.4, 2.2, 2.3, 2.4, 3.1, 3.6, 3.7_

  - [x] 3.3 Update `TrackerScreen.tsx` to remove blocking loader and add skeletons
    - Change `isInitialLoad` logic: only show full-screen `<Loader>` if there is NO cached data at all (check `useHealthDataStore.getState().data` equals `defaultHealthData` or is null)
    - If cached data exists, render screen layout immediately with cached values
    - Add skeleton/shimmer placeholders for weekly chart section when `isWeekPending && !weekData`
    - Add skeleton/shimmer placeholders for streaks section when `isStreakPending && !streakData`
    - Add staleness check in `useFocusEffect`: read `useHealthDataStore.getState().lastFetchedAt`, skip `refresh(true)` if within 30s (pull-to-refresh `handleRefresh` always forces)
    - _Bug_Condition: TrackerScreen shows full-screen Loader whenever isLoading=true even if stale cache exists_
    - _Expected_Behavior: TrackerScreen renders cached data immediately, shows skeletons only for truly-loading sections, deduplicates focus refresh_
    - _Preservation: PermissionDeniedScreen still renders when platform=unavailable (Requirement 3.5); pull-to-refresh handleRefresh always fetches (Requirement 3.1)_
    - _Requirements: 1.1, 2.1, 2.3, 2.4, 3.1, 3.5_

  - [x] 3.4 Create `SkeletonPlaceholder` component (optional)
    - Create `src/features/health/components/tracker/SkeletonPlaceholder.tsx`
    - Implement lightweight animated opacity/pulsing gray block component
    - Accept `width`, `height`, `borderRadius` props for flexible sizing
    - Use `Animated` API with looping opacity animation (0.3 → 1.0 → 0.3)
    - Export for use in TrackerScreen's weekly chart and streaks sections
    - _Requirements: 2.1_

  - [x] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Cached Data Shown Immediately on Launch
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (hydration from cache, no full-screen loader, deduplication)
    - When this test passes, it confirms: useHealth hydrates from MMKV, TrackerScreen shows cached data, at most one refresh cycle fires
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Refresh and Sync Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm pull-to-refresh, auto-refresh, backend sync throttle, logout reset, permission flows, and native step counter all behave identically
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite to verify no regressions
  - Verify bug condition test passes (Property 1 — cached data shown immediately)
  - Verify preservation tests pass (Property 2 — existing behavior unchanged)
  - Verify TypeScript compilation succeeds with no type errors
  - Ensure all tests pass, ask the user if questions arise


## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3.1", "3.2", "3.3", "3.4"] },
    { "id": 2, "tasks": ["3.5", "3.6"] },
    { "id": 3, "tasks": ["4"] }
  ]
}
```

## Notes

- Tasks 1 and 2 MUST be completed BEFORE any implementation work (tasks 3.x)
- Task 1 is expected to FAIL on unfixed code — this confirms the bug exists
- Task 2 is expected to PASS on unfixed code — this captures baseline behavior
- Tasks 3.5 and 3.6 re-run existing tests from tasks 1 and 2 respectively
- The staleness threshold (30s) is configurable via `STALE_THRESHOLD_MS` constant
- SkeletonPlaceholder (task 3.4) is optional but recommended for UX polish
- Test files: `src/features/health/__tests__/bugCondition.property.test.ts` and `src/features/health/__tests__/preservation.property.test.ts`
