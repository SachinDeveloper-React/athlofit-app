// src/utils/date.ts
//
// Local date utilities for consistent day-boundary detection across the app.
// CRITICAL: Never use `new Date().toISOString().split('T')[0]` for day comparisons —
// that returns the date in UTC, which differs from the user's local date near midnight.

/**
 * Returns today's date as "YYYY-MM-DD" in the device's local timezone.
 *
 * This is the correct way to determine "today" for step resets, day-change
 * detection, and date comparisons. The native Android layer uses
 * `LocalDate.now()` (also device-local), so this keeps JS and native in sync.
 *
 * Why not toISOString()?
 *   `new Date().toISOString()` returns UTC time. A user in IST (UTC+5:30)
 *   at 12:30 AM local time gets "previous day" from toISOString() because
 *   it's still 7:00 PM UTC of the previous day. This causes the midnight
 *   reset to fail — the code thinks the day hasn't changed yet.
 */
export function getLocalToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
