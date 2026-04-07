// src/features/health/hooks/useEarnCoins.ts
import { useMutation } from '@tanstack/react-query';
import { gamificationService } from '../service/gamification.service';
import { useGamificationStore } from '../store/gamificationStore';

export function useEarnCoins() {
  const setCoinsBalance = useGamificationStore(s => s.setCoinsBalance);
  const coinsEarnedToday = useGamificationStore(s => s.coinsEarnedToday);
  const lastCoinDate = useGamificationStore(s => s.lastCoinDate);
  const coinsBalance = useGamificationStore(s => s.coinsBalance);

  // Whether coins have already been claimed today
  const todayStr = new Date().toDateString();
  const claimedToday = lastCoinDate === todayStr && coinsEarnedToday > 0;

  const mutation = useMutation({
    mutationFn: (coinsToAdd: number) =>
      gamificationService.earnCoins(coinsToAdd),
    onSuccess: (response) => {
      if (!response.success || !response.data) return;
      setCoinsBalance(response.data.coinsBalance);
    },
  });

  return {
    earnCoins: mutation.mutate,
    isPending: mutation.isPending,
    claimedToday,
    coinsBalance,
  };
}
