import { useQuery } from '@tanstack/react-query';
import { getLast7DaysRange } from '../utils/healthFormatters';
import { healthService } from '../service/health.service';

export function useWeeklySteps() {
  // Recompute the date range on every render so that after midnight the
  // query key changes and React Query automatically re-fetches with the
  // correct 7-day window for the new day.
  const todayISO = new Date().toISOString().slice(0, 10);
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
