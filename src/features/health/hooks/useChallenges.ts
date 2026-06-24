import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { challengeService } from '../service/challenge.service';

/**
 * Returns today's date as "YYYY-MM-DD" in local time.
 * Used for day-change detection so challenges refresh after midnight.
 */
function getTodayLocal(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const challengeKeys = {
  all: () => ['challenges'] as const,
  detail: (id: string) => ['challenge', id] as const,
};

export function useChallenges() {
  const queryClient = useQueryClient();

  // Track the current date so that when it changes (after midnight),
  // challenges are refetched with the correct period key.
  const [todayISO, setTodayISO] = useState(getTodayLocal);
  const lastKnownDateRef = useRef(todayISO);

  // ── Day-change detection: AppState foreground + midnight timer ──────────────
  useEffect(() => {
    const checkDateChange = () => {
      const currentDate = getTodayLocal();
      if (currentDate !== lastKnownDateRef.current) {
        lastKnownDateRef.current = currentDate;
        setTodayISO(currentDate);
        queryClient.invalidateQueries({ queryKey: challengeKeys.all() });
      }
    };

    // Detect day change when app comes back to foreground
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') checkDateChange();
    };

    // Schedule a timer for midnight so challenges refresh while the app is open
    const now = new Date();
    const midnight = new Date(now);
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 1, 0); // 1 second past midnight
    const msUntilMidnight = midnight.getTime() - now.getTime();

    const midnightTimer = setTimeout(checkDateChange, msUntilMidnight);
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      clearTimeout(midnightTimer);
      subscription.remove();
    };
  }, [queryClient]);

  return useQuery({
    queryKey: [...challengeKeys.all(), todayISO],
    queryFn:  () => challengeService.getAll(),
    select:   r => r.data ?? [],
    staleTime: 5 * 60_000, // 5 min — matches ChallengeTrackerCard so they share cache
    retry: 1,
  });
}

export function useChallengeDetail(id: string) {
  return useQuery({
    queryKey: challengeKeys.detail(id),
    queryFn:  () => challengeService.getById(id),
    select:   r => r.data,
    enabled:  !!id,
    staleTime: 30_000,
    retry: 1,
  });
}

/** Fetches filter options and section labels from the backend — cached 10 min */
export function useChallengeConfig() {
  return useQuery({
    queryKey: ['challenge-config'],
    queryFn:  () => challengeService.getConfig(),
    select:   r  => r.data,
    staleTime: 10 * 60_000,
    retry: 1,
  });
}
