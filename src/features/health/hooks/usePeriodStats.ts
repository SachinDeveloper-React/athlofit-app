// src/features/health/hooks/usePeriodStats.ts
import { useQuery } from '@tanstack/react-query';
import { fetchPeriodStats } from '../service/periodStatsService';

export function usePeriodStats() {
  return useQuery({
    queryKey: ['periodStats'],
    queryFn: fetchPeriodStats,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}
