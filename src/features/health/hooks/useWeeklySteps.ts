import { useQuery } from '@tanstack/react-query';
import { getLast7DaysRange } from '../utils/healthFormatters';
import { healthService } from '../service/health.service';

export function useWeeklySteps() {
  // ── Recompute the date range on every render so that after midnight the
  // query key changes and React Query automatically re-fetches with the
  // correct 7-day window for the new day.  The key includes today's ISO
  // date string so it rotates exactly at midnight.
  const todayISO = new Date().toISOString().slice(0, 10);
  const { from, to } = getLast7DaysRange();

  return useQuery({
    // Include todayISO so the key changes at midnight and triggers a fresh fetch
    queryKey: ['weekly-steps', todayISO, from, to],
    queryFn: () => healthService.getWeeklySteps({ from, to }),
    select: response => response.data ?? [],
    staleTime: 5 * 60_000,   // 5 min — re-fetch on focus if stale
    retry: 1,
  });
}
