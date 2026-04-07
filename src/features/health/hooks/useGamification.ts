// src/features/health/hooks/useGamification.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gamificationService } from '../service/gamification.service';
import { useGamificationStore } from '../store/gamificationStore';

export function useGamification() {
  const syncWithService = useGamificationStore(s => s.syncWithService);

  return useMutation({
    mutationFn: () => gamificationService.getGamification(),
    onSuccess: (response) => {
      if (!response.success || !response.data) return;
      syncWithService(response.data);
    },
  });
}

export function useCoinData() {
  // Invalidate after a claim so the list refreshes
  return useQuery({
    queryKey: ['coin-data'],
    queryFn: () => gamificationService.getCoinData(),
    // Select data from the API response envelope
    select: (response) => response.data ?? {
      balance: 0,
      transactions: [],
      claimable: [],
    },
    // Keep data fresh — refetch every 60 seconds
    staleTime: 60_000,
    retry: 2,
  });
}

export function useClaimReward() {
  const queryClient = useQueryClient();
  const setCoinsBalance = useGamificationStore(s => s.setCoinsBalance);

  return useMutation({
    mutationFn: (rewardId: string) => gamificationService.claimReward(rewardId),
    onSuccess: (response) => {
      if (response.success && response.data) {
        setCoinsBalance(response.data.newBalance);
        // Refresh the coin screen data after claiming
        queryClient.invalidateQueries({ queryKey: ['coin-data'] });
      }
    },
  });
}