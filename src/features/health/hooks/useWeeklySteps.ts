import { useQuery } from '@tanstack/react-query';
import { getLast7DaysRange } from '../utils/healthFormatters';
import { healthService } from '../service/health.service';

export function useWeeklySteps() {
  const { from, to } = getLast7DaysRange();

  return useQuery({
    queryKey: ['weekly-steps', from, to],
    queryFn: () => healthService.getWeeklySteps({ from, to }),
    select: response => response.data ?? [],
    staleTime: 5 * 60_000,   // 5 min — re-fetch on focus if stale
    retry: 1,
  });
}
