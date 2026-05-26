# Bugfix Requirements Document

## Introduction

The weekly step chart displays stale data after midnight. When the app transitions from background to foreground (or is opened) after midnight, the chart continues to show the previous day's step count in the "today" position instead of resetting to 0 or showing the new day's actual steps. The day labels update correctly, but the underlying data and 7-day window remain stale because `useWeeklySteps` computes `todayISO` at render time and no mechanism forces a re-render or query invalidation when the date changes while the app is backgrounded.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the app transitions from background to foreground after midnight THEN the system displays yesterday's step count in the "today" column of the weekly chart

1.2 WHEN the app transitions from background to foreground after midnight THEN the system uses a stale 7-day window (computed before midnight) for the weekly steps query, returning data for the wrong date range

1.3 WHEN the app was open before midnight and remains in memory past midnight THEN the system does not invalidate or re-key the `weekly-steps` React Query, causing the cached stale data to persist

1.4 WHEN the AppState listener in `useHealth` fires on foreground resume after midnight THEN the system refreshes health data but does not invalidate or refetch the `weekly-steps` query

### Expected Behavior (Correct)

2.1 WHEN the app transitions from background to foreground after midnight THEN the system SHALL recompute `todayISO` and the 7-day range, and refetch weekly steps so that the "today" column shows 0 steps (or the actual steps recorded for the new day)

2.2 WHEN the app transitions from background to foreground after midnight THEN the system SHALL use a freshly computed 7-day window that includes the new current day as the last entry

2.3 WHEN the date changes while the app is in memory (backgrounded or foregrounded) THEN the system SHALL invalidate the `weekly-steps` query cache so that the next render fetches data for the correct date range

2.4 WHEN the AppState listener detects a foreground transition on a new day THEN the system SHALL trigger a refetch of the weekly steps data in addition to the existing health data refresh

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the app transitions from background to foreground on the same calendar day THEN the system SHALL CONTINUE TO display the current cached weekly steps data without unnecessary refetching (respecting React Query's normal staleTime behavior)

3.2 WHEN the user navigates to the TrackerScreen via tab switching (useFocusEffect fires) THEN the system SHALL CONTINUE TO call `refreshWeek()` as it does today

3.3 WHEN the user performs a pull-to-refresh on the TrackerScreen THEN the system SHALL CONTINUE TO refetch weekly steps alongside other health data

3.4 WHEN the weekly steps query is refetched during the same day THEN the system SHALL CONTINUE TO return the correct step counts for each of the 7 days in the current window

3.5 WHEN the hydration midnight reset fires THEN the system SHALL CONTINUE TO reset hydration data independently without affecting weekly steps behavior
