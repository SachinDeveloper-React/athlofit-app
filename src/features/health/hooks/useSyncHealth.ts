import { useMutation } from '@tanstack/react-query';
import { healthService } from '../service/health.service';
import type { HealthData } from '../types/healthTypes';

export function useSyncHealth() {
  const mutation = useMutation({
    mutationFn: (data: Partial<HealthData> & { date?: string; goalMet?: boolean }) =>
      healthService.syncHealthData(data),
  });

  return {
    syncHealth: mutation.mutate,
    isPending: mutation.isPending,
  };
}
