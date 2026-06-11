import { useMutation, useQueryClient } from '@tanstack/react-query';
import { gamificationService } from '../service/gamification.service';
import { useDailyStepGoalRewardConfig } from '../../../store/appConfigStore';

export function useDailyStepGoalReward() {
  const queryClient = useQueryClient();
  const rewardConfig = useDailyStepGoalRewardConfig();

  const mutation = useMutation({
    mutationFn: () => gamificationService.claimReward('steps_daily'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coin-data'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    },
  });

  return {
    claimReward: mutation.mutate,
    isPending: mutation.isPending,
    isEnabled: rewardConfig.enabled,
    coinValue: rewardConfig.coin_value,
  };
}
