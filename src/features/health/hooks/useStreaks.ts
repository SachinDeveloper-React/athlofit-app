// src/features/health/hooks/useStreaks.ts
import { useQuery } from '@tanstack/react-query';
import { gamificationService } from '../service/gamification.service';
import type { StreaksResponseData } from '../types/gamification.type';

export const useStreaks = () => {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['streaks'],
    queryFn: async () => {
      const res = await gamificationService.getStreaks();
      if (!res.success) throw new Error(res.message);
      return res.data as StreaksResponseData;
    },
    staleTime: 30_000, // 30s
  });

  return {
    streakDays: data?.streakDays ?? 0,
    bestStreakDays: data?.bestStreakDays ?? 0,
    nextBadgeAt: data?.nextBadgeAt ?? null,
    badges: data?.badges ?? [],
    isLoading,
    isRefetching,
    refetch,
  };
};
