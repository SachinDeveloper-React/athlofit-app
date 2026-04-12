// src/features/account/hooks/useReferral.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { referralService } from '../service/referralService';
import { useGamificationStore } from '../../health/store/gamificationStore';

export const useReferral = () => {
  const queryClient = useQueryClient();
  const setCoinsBalance = useGamificationStore(s => s.setCoinsBalance);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['referral'],
    queryFn: async () => {
      const res = await referralService.getStats();
      return res.data;
    },
    staleTime: 30_000,
  });

  const applyMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await referralService.applyCode(code);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onSuccess: res => {
      if (res?.data?.refereeNewBalance !== undefined) {
        setCoinsBalance(res.data.refereeNewBalance);
      }
      queryClient.invalidateQueries({ queryKey: ['referral'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
      queryClient.invalidateQueries({ queryKey: ['coinData'] });
    },
  });

  return {
    stats: data ?? null,
    isLoading,
    isRefetching,
    refetch,
    applyCode: applyMutation.mutate,
    isApplying: applyMutation.isPending,
    applyError: applyMutation.error?.message ?? null,
    applySuccess: applyMutation.isSuccess,
  };
};
