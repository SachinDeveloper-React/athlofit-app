import { useMutation } from '@tanstack/react-query';
import { getLast7DaysRange } from '../utils/healthFormatters';
import { healthService } from '../service/health.service';

export function useWeeklySteps() {
  const { from, to } = getLast7DaysRange();
  return useMutation({
    mutationFn: () => healthService.getWeeklySteps({ from, to }),
    onSuccess: response => {
      const { success, data } = response;

      if (!success) return;
    },
  });
}
