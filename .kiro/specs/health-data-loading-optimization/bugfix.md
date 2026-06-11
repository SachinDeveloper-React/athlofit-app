# Bugfix Requirements Document

## Introduction

The TrackerScreen takes several seconds to display content on app open because health data (steps, calories, etc.) is not persisted between launches. The `useHealth` hook starts with all-zero `defaultHealthData` and `isLoading: true`, which causes the screen to show a full-screen `<Loader>` until all data sources resolve. Additionally, overlapping refresh triggers (`useFocusEffect`, `AppState` listener, and `useEffect` watching `data`) cause 3-4 redundant re-renders on initial load. The user expects to see their last-known step count immediately and skeleton placeholders for loading sections, with a single quiet refresh cycle.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the app opens and health data has not yet loaded from HealthKit/Health Connect THEN the system displays a full-screen `<Loader>` blocking all content until ALL parallel data sources (health, weekly steps, streaks) resolve

1.2 WHEN the app opens THEN the system starts with `defaultHealthData` (all zeros) because `healthDataStore` only persists `loginTimestamp` via MMKV and does not cache the actual `HealthData` values between launches

1.3 WHEN the TrackerScreen mounts THEN the system triggers multiple overlapping refresh calls (`useFocusEffect` calls `refresh(true)` + `refreshWeek()`, `AppState` foreground listener calls `loadData` or `setup()`, and `useEffect` watching `data` triggers `syncHealth` which invalidates React Query caches) resulting in 3-4 visible re-renders

1.4 WHEN the user switches tabs and returns to TrackerScreen THEN the system calls `refresh(true)` + `refreshWeek()` via `useFocusEffect` even if data was fetched moments ago, causing unnecessary re-renders and potential flicker

### Expected Behavior (Correct)

2.1 WHEN the app opens and health data has not yet loaded from HealthKit/Health Connect THEN the system SHALL immediately display the TrackerScreen layout with the last-known step count (and other health metrics) from MMKV-persisted cache, showing skeleton placeholders only for sections whose data is not yet available (weekly chart, streaks)

2.2 WHEN the app opens THEN the system SHALL hydrate `useHealth` initial state from MMKV-persisted `HealthData` (including steps, calories, distance, activeMinutes) so the user sees their last-known values instantly rather than zeros

2.3 WHEN the TrackerScreen mounts THEN the system SHALL execute at most one refresh cycle on initial load by deduplicating/debouncing the `useFocusEffect`, `AppState` foreground, and data-sync triggers, resulting in a single data fetch rather than 3-4 cascading re-renders

2.4 WHEN the user switches tabs and returns to TrackerScreen within a short time window (e.g., < 30 seconds) THEN the system SHALL skip redundant refresh calls if data was already fetched recently, preventing unnecessary re-renders

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the user performs a pull-to-refresh gesture THEN the system SHALL CONTINUE TO fetch fresh data from HealthKit/Health Connect and update all sections

3.2 WHEN the app returns from background after an extended period THEN the system SHALL CONTINUE TO refresh health data from the device health platform

3.3 WHEN health data is successfully loaded THEN the system SHALL CONTINUE TO sync data to the backend via `syncHealth` (subject to existing throttle: 5-minute interval, 10-step delta)

3.4 WHEN the user logs out and a different user logs in THEN the system SHALL CONTINUE TO reset cached health data and fetch fresh data for the new account

3.5 WHEN Health Connect or HealthKit is unavailable or permission is denied THEN the system SHALL CONTINUE TO show the appropriate `PermissionDeniedScreen` or `HealthGate` UI

3.6 WHEN the native step counter is active as a fallback THEN the system SHALL CONTINUE TO use its real-time step value as the displayed step count

3.7 WHEN the app is online and periodic auto-refresh fires (60s interval) THEN the system SHALL CONTINUE TO silently update health data in the background without showing loading indicators

---

## Bug Condition

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type AppLaunchState
  OUTPUT: boolean
  
  // The bug triggers when the app opens/foregrounds and there is no
  // persisted health data cache, forcing a full-screen loader and
  // multiple refresh cascades
  RETURN X.hasCachedHealthData = false 
     AND X.isAppOpening = true
END FUNCTION
```

## Fix Property

```pascal
// Property: Fix Checking — Cached data shown immediately on launch
FOR ALL X WHERE isBugCondition(X) DO
  result ← renderTrackerScreen'(X)
  ASSERT result.showsFullScreenLoader = false
  ASSERT result.displaysLastKnownSteps = true
  ASSERT result.showsSkeletonForLoadingSections = true
  ASSERT result.refreshCycleCount <= 1
END FOR
```

## Preservation Property

```pascal
// Property: Preservation Checking — Non-buggy flows unchanged
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT renderTrackerScreen(X) = renderTrackerScreen'(X)
END FOR
```
