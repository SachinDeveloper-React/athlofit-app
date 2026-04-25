import { useMutation, useQuery } from '@tanstack/react-query';
import { challengeService } from '../service/challenge.service';

export const challengeKeys = {
  all: () => ['challenges'] as const,
  detail: (id: string) => ['challenge', id] as const,
};

export function useChallenges() {
  return useQuery({
    queryKey: challengeKeys.all(),
    queryFn:  () => challengeService.getAll(),
    select:   r => r.data ?? [],
    staleTime: 30_000,
    retry: 1,
  });
}

export function useChallengeDetail(id: string) {
  return useQuery({
    queryKey: challengeKeys.detail(id),
    queryFn:  () => challengeService.getById(id),
    select:   r => r.data,
    enabled:  !!id,
    staleTime: 30_000,
    retry: 1,
  });
}

/** Fetches filter options and section labels from the backend — cached 10 min */
export function useChallengeConfig() {
  return useQuery({
    queryKey: ['challenge-config'],
    queryFn:  () => challengeService.getConfig(),
    select:   r  => r.data,
    staleTime: 10 * 60_000,
    retry: 1,
  });
}
