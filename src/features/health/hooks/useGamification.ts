

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gamificationService } from '../service/gamification.service';
import { useGamificationStore } from '../store/gamificationStore';

export function useGamification() {
  const syncWithService = useGamificationStore(s => s.syncWithService);

  const query = useQuery({
    queryKey: ['gamification'],
    queryFn: () => gamificationService.getGamification(),
    staleTime: 5 * 60_000, // 5 min — matches global default, no need to refetch constantly
  });

  // Sync to Zustand store in an effect — never during render
  useEffect(() => {
    if (query.data?.success && query.data?.data) {
      syncWithService(query.data.data);
    }
  }, [query.data, syncWithService]);

  // Expose refetch so TrackerScreen can trigger a manual refresh
  return { refetch: query.refetch, isPending: query.isFetching };
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