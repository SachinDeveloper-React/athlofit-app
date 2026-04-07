import { useMutation } from '@tanstack/react-query';
import { gamificationService } from '../service/gamification.service';
import { useState } from 'react';
import type { StreaksResponseData } from '../types/gamification.type';

export function useStreak() {
  const [streakData, setStreakData] = useState<StreaksResponseData | null>(null);

  const mutation = useMutation({
    mutationFn: () => gamificationService.getStreaks(),
    onSuccess: (response) => {
      if (response.success && response.data) {
        setStreakData(response.data);
      }
    },
  });

  return {
    ...mutation,
    streakData,
  };
}
