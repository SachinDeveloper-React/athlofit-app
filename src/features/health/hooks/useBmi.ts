// src/features/health/hooks/useBmi.ts
// ─── React Query hooks for BMI ────────────────────────────────────────────────

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bmiService } from '../service/bmi.service';
import type { SaveBmiPayload } from '../service/bmi.service';

const BMI_HISTORY_KEY = ['bmi-history'] as const;

// ─── useBmiHistory ────────────────────────────────────────────────────────────

export function useBmiHistory(limit = 10) {
  return useQuery({
    queryKey: [...BMI_HISTORY_KEY, limit],
    queryFn: () => bmiService.getHistory(limit),
    staleTime: 5 * 60 * 1000,
  });
}

// ─── useSaveBmi ───────────────────────────────────────────────────────────────

export function useSaveBmi() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveBmiPayload) => bmiService.save(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BMI_HISTORY_KEY });
    },
  });
}
