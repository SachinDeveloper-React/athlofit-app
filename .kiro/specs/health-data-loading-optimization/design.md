# Health Data Loading Optimization — Bugfix Design

## Overview

The TrackerScreen suffers from a slow cold-start experience: on every app launch the user sees a full-screen loader for several seconds because (a) HealthData is not persisted between sessions, (b) the hook starts with all-zero defaults, and (c) multiple overlapping refresh triggers (`useFocusEffect`, `AppState` foreground listener, initial `useEffect`) fire simultaneously causing 3-4 cascading re-renders. The fix persists the full `HealthData` snapshot in MMKV, hydrates `useHealth` from cache on mount, replaces the blocking loader with cached-data + skeleton placeholders, and deduplicates the initial refresh triggers into a single fetch cycle with a staleness guard.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the perceived bug — the app opens or foregrounds and there is no persisted health data cache, forcing a full-screen `<Loader>` and multiple redundant refresh cycles.
- **Property (P)**: The desired behavior when the bug condition holds — the screen renders immediately with cached data (or skeleton placeholders if no cache exists) and executes at most one background refresh cycle.
- **Preservation**: Existing behaviors that must remain unchanged — pull-to-refresh, background auto-refresh (60s interval), backend sync throttle (5 min / 10-step delta), logout data clearing, permission-denied flows, native step counter fallback.
- **healthDataStore**: The Zustand store in `src/features/health/store/healthDataStore.ts` that currently persists only `loginTimestamp` via MMKV but NOT the `HealthData` object.
- **useHealth**: The hook in `src/features/health/hooks/useHealth.ts` that initializes with `defaultHealthData` (all zeros) and manages health platform setup, data loading, and auto-refresh.
- **TrackerScreen**: The main health screen in `src/features/health/screens/TrackerScreen.tsx` that shows a full-screen `<Loader>` when `isInitialLoad` is true.
- **staleness window**: A configurable time threshold (30 seconds) within which a repeated refresh call is considered redundant and skipped.

## Bug Details

### Bug Condition

The bug manifests when a user opens the app or returns to the TrackerScreen and health data has not been persisted from a previous session. The `useHealth` hook initializes `data` with `defaultHealthData` (all zeros) and `isLoading: true`. The TrackerScreen evaluates `isInitialLoad` as `true` and renders a full-screen `<Loader>`. Simultaneously, three refresh triggers fire: (1) `useFocusEffect` calls `refresh(true)` + `refreshWeek()`, (2) the `AppState` listener fires `loadData` or `setup()` on foreground transition, and (3) the `useEffect` watching `data` triggers `syncHealth` which invalidates React Query caches. This results in 3-4 visible re-renders before the screen settles.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type AppLaunchState
  OUTPUT: boolean
  
  RETURN input.healthDataStore.persistedHealthData = null
         AND input.isAppOpeningOrForegrounding = true
         AND (input.timeSinceLastFetch > 30s OR input.lastFetchTimestamp = null)
END FUNCTION
```

### Examples

- **Cold start, no cache**: User installs app, opens TrackerScreen → sees full-screen loader for 3-5 seconds while Health Connect initializes and fetches. Expected: show zeros with skeleton placeholders, no blocking loader.
- **Warm restart, cache exists**: User reopens app after force-close → current behavior shows loader + zeros. Expected: show cached 4,230 steps instantly, refresh in background.
- **Tab switch within 10s**: User navigates to Profile tab and returns → `useFocusEffect` fires `refresh(true)` again. Expected: skip refresh since data is < 30s old.
- **Tab switch after 60s**: User leaves TrackerScreen for over a minute → returns. Expected: refresh fires once (deduplicated), no loader shown if cache is available.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Pull-to-refresh (`handleRefresh`) must continue to force-fetch fresh data from HealthKit/Health Connect and update all sections regardless of staleness
- The 60-second auto-refresh interval timer must continue to silently poll for updated data
- Backend sync via `syncHealth` must continue to respect the 5-minute / 10-step throttle
- Logout must continue to reset all cached health data (call `healthDataStore.reset()`)
- `PermissionDeniedScreen` and `HealthGate` UI must continue to display when Health Connect/HealthKit is unavailable or permissions are denied
- Native step counter fallback must continue to override the step count when `stepService.getSource() === 'native_sensor'`
- Widget sync via `useWidgetSync` must continue to receive current steps and goal

**Scope:**
All inputs that do NOT involve the initial load path (i.e., pull-to-refresh, auto-refresh timer ticks, manual log writes, permission flows) should be completely unaffected by this fix. This includes:
- User-initiated pull-to-refresh gestures
- Auto-refresh interval callbacks (every 60s)
- Manual health data writes (logHeartRate, logWeight, etc.)
- Permission grant/deny flows
- Logout and account-switch logic

## Hypothesized Root Cause

Based on the bug description and code analysis, the issues are:

1. **Missing Data Persistence**: In `healthDataStore.ts`, the `partialize` option only persists `loginTimestamp`:
   ```ts
   partialize: (state) => ({ loginTimestamp: state.loginTimestamp })
   ```
   This means `data` (the `HealthData` object) and `lastUpdated` are never written to MMKV, so on restart the store initializes with `defaultHealthData` (all zeros).

2. **No Cache Hydration in useHealth**: The `useHealth` hook always starts with `useState<HealthData>(defaultHealthData)`. It never reads from `healthDataStore` to seed its initial state, so even if data were persisted, the hook would still start at zero.

3. **Blocking Full-Screen Loader**: `TrackerScreen` evaluates `isInitialLoad` which is `true` whenever `isLoading && !isReady`. Since `useHealth` starts `isLoading: true` and `isReady: false`, the loader blocks the entire screen until `setup()` completes — even though stale-but-useful cached data could be shown.

4. **Overlapping Refresh Triggers**: On mount, three independent triggers fire concurrently:
   - `useFocusEffect` → `refresh(true)` + `refreshWeek()`
   - `AppState` listener (if app was backgrounded during navigation) → `loadData()` or `setup()`
   - `useEffect` watching `[data, isReady, lastUpdated, ...]` → `syncHealth()` → invalidates React Query → triggers re-render
   
   There is no deduplication or staleness check, so all three execute independently causing multiple state updates.

## Correctness Properties

Property 1: Bug Condition — Cached Data Shown Immediately on Launch

_For any_ app launch or foreground event where persisted HealthData exists in MMKV, the TrackerScreen SHALL render immediately with the cached values (no full-screen loader) and execute at most one background refresh cycle, resulting in ≤ 2 render passes (initial cached render + data update after fetch).

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation — Existing Refresh and Sync Behavior Unchanged

_For any_ input that is NOT an initial load (pull-to-refresh, auto-refresh timer, manual data writes, permission flows, logout), the fixed code SHALL produce exactly the same behavior as the original code, preserving pull-to-refresh responsiveness, 60s auto-refresh, backend sync throttle, permission gating, and native step counter fallback.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/features/health/store/healthDataStore.ts`

**Changes**:
1. **Expand `partialize`** to persist the full `HealthData` object and `lastUpdated` timestamp alongside `loginTimestamp`:
   ```ts
   partialize: (state) => ({
     loginTimestamp: state.loginTimestamp,
     data: state.data,
     lastUpdated: state.lastUpdated,
   })
   ```
2. **Add a `lastFetchedAt` field** (numeric timestamp) to track when the last successful fetch completed, enabling staleness checks.

---

**File**: `src/features/health/hooks/useHealth.ts`

**Function**: `useHealth`

**Changes**:
1. **Hydrate initial state from store**: Read `healthDataStore.getState().data` and `healthDataStore.getState().lastUpdated` synchronously on hook initialization to seed `useState`:
   ```ts
   const cachedData = useHealthDataStore.getState().data;
   const cachedLastUpdated = useHealthDataStore.getState().lastUpdated;
   const [data, setData] = useState<HealthData>(cachedData ?? defaultHealthData);
   const [lastUpdated, setLastUpdated] = useState<Date | null>(cachedLastUpdated);
   ```
2. **Persist data on every successful fetch**: After `setData(result)` in `loadData`, also call `useHealthDataStore.getState().setData(result)` and `setLastUpdated(...)` so the store stays in sync with MMKV.
3. **Add a `lastFetchedAtRef`** to track the timestamp of the last successful fetch within the hook.
4. **Add staleness guard to `refresh`**: Before executing `loadData`, check if `Date.now() - lastFetchedAtRef.current < STALE_THRESHOLD_MS` (30s). If data is fresh, skip the fetch. The guard does NOT apply to explicit user pull-to-refresh (add a `force` parameter).
5. **Deduplicate `setup()` calls**: Add an `isSettingUpRef` guard so that concurrent calls to `setup()` from `AppState` listener and the boot `useEffect` collapse into one execution.
6. **If cached data exists on mount, set `isLoading: false`** initially so the TrackerScreen doesn't show the full-screen loader.

---

**File**: `src/features/health/screens/TrackerScreen.tsx`

**Changes**:
1. **Remove full-screen `<Loader>` for cached-data case**: Change the `isInitialLoad` guard so it only shows the full-screen loader if there is NO cached data at all (truly first-ever launch). If cached data exists, render the screen layout immediately.
2. **Add skeleton placeholders**: For sections whose data is still loading (weekly chart when `isWeekPending && !weekData`, streaks when `isStreakPending && !streakData`), render lightweight skeleton/shimmer components instead of blocking the whole screen.
3. **Deduplicate `useFocusEffect` refresh**: Add a staleness check before calling `refresh(true)` — skip if the hook's `lastFetchedAt` is within 30 seconds. Pull-to-refresh (`handleRefresh`) always forces regardless of staleness.

---

**New File (optional)**: `src/features/health/components/tracker/SkeletonPlaceholder.tsx`

**Purpose**: A lightweight shimmer/skeleton component for weekly chart and streak sections while their data loads. Uses animated opacity or a simple pulsing gray block to indicate loading state without blocking the entire screen.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate the app launch sequence with an empty MMKV store and verify the rendering behavior of TrackerScreen and initialization behavior of useHealth. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Empty Store Cold Start**: Mock MMKV with no persisted health data, mount useHealth → assert that `data` starts as `defaultHealthData` and `isLoading` is `true` (will confirm the bug on unfixed code)
2. **Full-Screen Loader Rendering**: Mount TrackerScreen with `isLoading: true` and no cached data → assert that `<Loader>` is rendered (will confirm the blocking behavior)
3. **Multiple Refresh Triggers**: Mount TrackerScreen and simulate simultaneous `useFocusEffect` + `AppState` foreground → count how many times `loadData` is called (will show 3+ calls on unfixed code)
4. **Rapid Tab Switch**: Mount TrackerScreen, simulate blur+focus within 5s → assert `refresh` is called again unnecessarily (will confirm redundant refresh on unfixed code)

**Expected Counterexamples**:
- `useHealth` always starts with zeros regardless of what was previously fetched
- TrackerScreen renders `<Loader>` on every cold start even when previous data exists
- Multiple concurrent `loadData` calls observed on a single mount
- Possible causes: `partialize` excludes `data`, no cache hydration, no deduplication guard

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := renderTrackerScreen_fixed(input)
  ASSERT result.showsFullScreenLoader = false
  ASSERT result.displaysLastKnownData = true OR result.showsSkeletonPlaceholders = true
  ASSERT result.refreshCycleCount <= 1
  ASSERT result.renderCount <= 2
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT TrackerScreen_original(input) = TrackerScreen_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (random health data values, random timing scenarios)
- It catches edge cases that manual unit tests might miss (e.g., boundary at exactly 30s staleness window)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for pull-to-refresh, auto-refresh timer callbacks, and manual data writes, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Pull-to-Refresh Preservation**: Verify that calling `handleRefresh` always forces a fresh fetch regardless of staleness, returns fresh data, and clears the refreshing spinner — behavior unchanged
2. **Auto-Refresh Preservation**: Verify that the 60s interval timer continues to call `loadData(platform, true)` silently without triggering loading state
3. **Backend Sync Preservation**: Verify that `syncHealth` is still called with the 5-min / 10-step throttle when data changes, unaffected by the deduplication logic
4. **Logout Preservation**: Verify that `healthDataStore.reset()` clears persisted data, and next login starts fresh

### Unit Tests

- Test that `healthDataStore` with expanded `partialize` correctly persists and restores `HealthData` from MMKV
- Test that `useHealth` hydrates initial state from cached store data (non-zero initial values)
- Test that `useHealth` with `isLoading: false` when cached data exists on mount
- Test staleness guard: `refresh()` skips fetch when `lastFetchedAt` is < 30s ago
- Test staleness guard: `refresh()` executes fetch when `lastFetchedAt` is > 30s ago
- Test `setup()` deduplication: concurrent calls result in only one execution
- Test TrackerScreen renders cached data immediately without full-screen loader
- Test TrackerScreen shows skeleton placeholders for loading sections

### Property-Based Tests

- Generate random `HealthData` objects, persist to store, mount `useHealth` → verify initial state matches persisted values (hydration property)
- Generate random timing sequences (focus events at random intervals) → verify at most one fetch fires per 30s window (deduplication property)
- Generate random non-bug-condition inputs (pull-to-refresh, timer ticks) → verify behavior matches original implementation (preservation property)

### Integration Tests

- Test full app cold-start flow: clear MMKV → launch → verify loader shown briefly → data loads → cache populated → force-close → relaunch → verify cached data shown immediately
- Test account switch: login as User A → fetch data → logout → login as User B → verify User A's cached data is cleared and fresh fetch occurs
- Test permission flow: deny Health Connect permission → verify PermissionDeniedScreen still appears, not cached data
