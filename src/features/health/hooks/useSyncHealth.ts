import { useMutation, useQueryClient } from '@tanstack/react-query';
import { healthService } from '../service/health.service';
import type { HealthData } from '../types/healthTypes';

export function useSyncHealth() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: Partial<HealthData> & { date?: string; goalMet?: boolean }) =>
      healthService.syncHealthData(data),
    onSuccess: () => {
      // Invalidate coin-data to refresh any passive or hydration rewards
      queryClient.invalidateQueries({ queryKey: ['coin-data'] });
    }
  });

  return {
    syncHealth: mutation.mutate,
    isPending: mutation.isPending,
  };
}
