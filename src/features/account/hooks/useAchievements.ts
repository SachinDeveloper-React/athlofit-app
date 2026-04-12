import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gamificationService } from '../../health/service/gamification.service';
import { useGamificationStore } from '../../health/store/gamificationStore';

export interface AchievementItem {
  id: string;
  key: string;
  title: string;
  description: string;
  reward: number;
  icon: string;
  criteriaType: string;
  targetValue: number;
  progress: number;
  isClaimable: boolean;
  isClaimed: boolean;
}

export const useAchievements = () => {
  const queryClient = useQueryClient();
  const setCoinsBalance = useGamificationStore(s => s.setCoinsBalance);

  const { data: achievements, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['achievements'],
    queryFn: async () => {
      const res = await gamificationService.getAdvancedAchievements();
      return res.data as AchievementItem[];
    },
  });

  const claimMutation = useMutation({
    mutationFn: async (achievementId: string) => {
      const res = await gamificationService.claimAdvancedAchievement(achievementId);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onSuccess: (res) => {
      // Optimistically update the balance
      if (res?.data?.newBalance !== undefined) {
        setCoinsBalance(res.data.newBalance);
      }
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      // Also invalidate coin data and gamification
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
      queryClient.invalidateQueries({ queryKey: ['coinData'] });
    },
  });

  return {
    achievements: achievements ?? [],
    isLoading,
    isRefetching,
    refetch,
    claimAchievement: claimMutation.mutate,
    isClaiming: claimMutation.isPending,
  };
};
