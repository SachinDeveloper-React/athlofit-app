// src/features/health/hooks/useGamification.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gamificationService } from '../service/gamification.service';
import { useGamificationStore } from '../store/gamificationStore';

// src/features/health/hooks/useGamification.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gamificationService } from '../service/gamification.service';
import { useGamificationStore } from '../store/gamificationStore';

export function useGamification() {
  const syncWithService = useGamificationStore(s => s.syncWithService);

  // useQuery so it fires automatically on mount and keeps data fresh —
  // no need to manually call mutate() in useEffect
  const query = useQuery({
    queryKey: ['gamification'],
    queryFn: () => gamificationService.getGamification(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  // Sync to Zustand store whenever fresh data arrives
  if (query.data?.success && query.data?.data) {
    syncWithService(query.data.data);
  }

  // Keep the same mutate interface so TrackerScreen doesn't need changes
  const mutation = useMutation({
    mutationFn: () => gamificationService.getGamification(),
    onSuccess: (response) => {
      if (!response.success || !response.data) return;
      syncWithService(response.data);
    },
  });

  return mutation;
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