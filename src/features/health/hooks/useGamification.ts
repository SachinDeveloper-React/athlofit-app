

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { gamificationService } from '../service/gamification.service';
import { useGamificationStore } from '../store/gamificationStore';

export function useGamification() {
  const syncWithService = useGamificationStore(s => s.syncWithService);

  const query = useQuery({
    queryKey: ['gamification'],
    queryFn: () => gamificationService.getGamification(),
    staleTime: 5 * 60_000,
    // Always refetch on mount to ensure coinBlocked status is fresh.
    // The banner depends on this data being up-to-date; stale cached data
    // from before a block was applied would hide it incorrectly.
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (query.data?.success && query.data?.data) {
      syncWithService(query.data.data);
    }
  }, [query.data, syncWithService]);

  return { refetch: query.refetch, isPending: query.isFetching };
}

// ─── Paginated coin transactions (infinite scroll) ────────────────────────────
export function useCoinTransactions() {
  return useInfiniteQuery({
    queryKey: ['coin-transactions'],
    queryFn: ({ pageParam = 1 }) =>
      gamificationService.getCoinData(pageParam as number, 20),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const p = lastPage.data?.pagination;
      if (!p || !p.hasMore) return undefined;
      return p.page + 1;
    },
    staleTime: 60_000,
    retry: 2,
    select: (data) => ({
      pages: data.pages,
      pageParams: data.pageParams,
      // Flatten all transactions across pages
      transactions: data.pages.flatMap(p => p.data?.transactions ?? []),
      // Balance and claimable come from the first page (always fresh)
      balance: data.pages[0]?.data?.balance ?? 0,
      claimable: data.pages[0]?.data?.claimable ?? [],
      totalTransactions: data.pages[0]?.data?.pagination?.total ?? 0,
    }),
  });
}

// ─── Legacy single-page query — kept for backward compat (CoinScreen stats) ──
export function useCoinData() {
  return useQuery({
    queryKey: ['coin-data'],
    queryFn: () => gamificationService.getCoinData(1, 20),
    select: (response) => response.data ?? {
      balance: 0,
      transactions: [],
      claimable: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1, hasMore: false },
    },
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
        queryClient.invalidateQueries({ queryKey: ['coin-data'] });
        queryClient.invalidateQueries({ queryKey: ['coin-transactions'] });
      }
    },
  });
}