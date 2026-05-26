import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getLast7DaysRange } from '../utils/healthFormatters';
import { healthService } from '../service/health.service';

/**
 * Returns today's date as "YYYY-MM-DD" in local time.
 */
function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useWeeklySteps() {
  const queryClient = useQueryClient();

  // Track the current date in state so that when it changes (after midnight),
  // the component re-renders with a new query key → React Query refetches.
  const [todayISO, setTodayISO] = useState(getTodayISO);
  const lastKnownDateRef = useRef(todayISO);

  // ── AppState listener: detect day change on foreground resume ──────────────
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        const currentDate = getTodayISO();
        if (currentDate !== lastKnownDateRef.current) {
          lastKnownDateRef.current = currentDate;
          setTodayISO(currentDate);
          // Invalidate the cache so React Query doesn't serve stale data
          // while the new query key's fetch is in flight.
          queryClient.invalidateQueries({ queryKey: ['weekly-steps'] });
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
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
