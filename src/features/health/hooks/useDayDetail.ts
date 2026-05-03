// src/features/health/hooks/useDayDetail.ts
import { useQuery } from '@tanstack/react-query';
import { fetchDayDetail } from '../service/dayDetailService';

export function useDayDetail(date: string) {
  return useQuery({
    queryKey: ['dayDetail', date],
    queryFn:  () => fetchDayDetail(date),
    staleTime: 2 * 60_000,
    enabled:  !!date,
    retry: 1,
  });
}
