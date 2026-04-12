// src/features/health/hooks/useLeaderboard.ts
import { useQuery } from '@tanstack/react-query';
import { gamificationService } from '../service/gamification.service';
import type { LeaderboardEntry } from '../types/leaderboard.types';
import { useAuthStore } from '../../auth/store/authStore';

export const useLeaderboard = () => {
  const userId = useAuthStore(s => s.user?._id);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const res = await gamificationService.getLeaderboard();
      if (!res.success) throw new Error(res.message);
      return res.data as LeaderboardEntry[];
    },
    staleTime: 60_000, // 1 min
  });

  const entries = data ?? [];
  const myEntry = entries.find(e => e.userId === userId) ?? null;

  return {
    entries,
    myEntry,
    isLoading,
    isRefetching,
    refetch,
  };
};
