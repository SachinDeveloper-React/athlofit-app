import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { gamificationService } from '../service/gamification.service';
import { useGamificationStore } from '../store/gamificationStore';
import { useStepCoinRate } from '../../../store/appConfigStore';

/**
 * Calculate coins earned from steps using the configurable rate.
 * Formula: parseFloat((Math.floor(steps / 100) * rate).toFixed(2))
 * Keeps 2 decimal places for fractional coin display.
 */
export const calculateStepCoins = (steps: number, rate: number): number => {
  return parseFloat((Math.floor(steps / 100) * rate).toFixed(2));
};

export function useEarnCoins() {
  const queryClient = useQueryClient();
  const rate = useStepCoinRate();
  const setCoinsBalance = useGamificationStore(s => s.setCoinsBalance);
  const coinsEarnedToday = useGamificationStore(s => s.coinsEarnedToday);
  const lastCoinDate = useGamificationStore(s => s.lastCoinDate);
  const coinsBalance = useGamificationStore(s => s.coinsBalance);

  // Whether coins have already been claimed today
  const todayStr = new Date().toDateString();
  const claimedToday = lastCoinDate === todayStr && coinsEarnedToday > 0;

  const getStepCoins = useCallback(
    (steps: number) => calculateStepCoins(steps, rate),
    [rate],
  );

  const mutation = useMutation({
    mutationFn: (coinsToAdd: number) =>
      gamificationService.earnCoins(coinsToAdd),
    onSuccess: (response) => {
      if (!response.success || !response.data) return;
      setCoinsBalance(response.data.coinsBalance);
      queryClient.invalidateQueries({ queryKey: ['coin-data'] });
    },
  });

  return {
    earnCoins: mutation.mutate,
    calculateStepCoins: getStepCoins,
    isPending: mutation.isPending,
    claimedToday,
    coinsBalance,
  };
}
