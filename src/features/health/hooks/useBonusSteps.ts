// src/features/health/hooks/useBonusSteps.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../utils/api';

export interface BonusStepEntry {
  _id: string;
  steps: number;
  date: string;
  reason: string;
  source: 'admin' | 'system' | 'reward' | 'challenge';
  createdAt: string;
}

interface BonusStepsResponse {
  entries: BonusStepEntry[];
  total: number;
  todayBonusSteps: number;
}

export function useBonusSteps(limit = 20) {
  return useQuery({
    queryKey: ['bonus-steps', limit],
    queryFn: async () => {
      const res = await api.get<{ data: BonusStepsResponse }>(
        `user/bonus-steps?limit=${limit}`,
      );
      return res.data;
    },
    staleTime: 5 * 60_000,
  });
}
