import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getLast7DaysRange } from '../utils/healthFormatters';
import { healthService } from '../service/health.service';

/**
 * Returns today's date as "YYYY-MM-DD" in local time.
 * Uses local date components (not UTC) so the day boundary matches the user's clock.
 */
function getTodayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function useWeeklySteps() {
  const queryClient = useQueryClient();

  // Track the current date in state so that when it changes (after midnight),
  // the component re-renders with a new query key → React Query refetches.
  const [todayISO, setTodayISO] = useState(getTodayISO);
  const lastKnownDateRef = useRef(todayISO);

  // ── Day-change detection: AppState foreground + midnight timer ──────────────
  useEffect(() => {
    const checkDateChange = () => {
      const currentDate = getTodayISO();
      if (currentDate !== lastKnownDateRef.current) {
        lastKnownDateRef.current = currentDate;
        setTodayISO(currentDate);
        queryClient.invalidateQueries({ queryKey: ['weekly-steps'] });
      }
    };

    // Detect day change when app comes back to foreground
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') checkDateChange();
    };

    // Schedule a timer for midnight so data refreshes while the app is open
    const now = new Date();
    const midnight = new Date(now);
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 0, 0); // exactly midnight
    const msUntilMidnight = midnight.getTime() - now.getTime();

    const midnightTimer = setTimeout(checkDateChange, msUntilMidnight);
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      clearTimeout(midnightTimer);
      subscription.remove();
    };
  }, [queryClient]);

  // Recompute the 7-day range based on the (possibly updated) todayISO.
  const { from, to } = getLast7DaysRange();

  return useQuery({
    queryKey: ['weekly-steps', todayISO, from, to],
    queryFn: () => healthService.getWeeklySteps({ from, to }),
    select: response => response.data ?? [],
    // staleTime 0 — always re-fetch on focus so the chart reflects the latest
    // synced data as soon as the user opens the tracker screen.
    staleTime: 0,
    retry: 1,
  });
}
