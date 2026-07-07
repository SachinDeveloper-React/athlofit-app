import { useState, useCallback } from 'react';
import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { api } from '../../../utils/api';
import { useAuthStore } from '../../auth/store/authStore';

const PRESETS = [
  { label: '3K', value: 3000, tag: 'Easy' },
  { label: '5K', value: 5000, tag: 'Light' },
  { label: '8K', value: 8000, tag: 'Moderate' },
  { label: '10K', value: 10000, tag: 'Active' },
  { label: '15K', value: 15000, tag: 'Intense' },
];

export type Preset = (typeof PRESETS)[number];

export interface StepsStats {
  distance: string;
  calories: number;
  time: number;
}

export interface UseStepsGoalReturn {
  steps: number;
  activePreset: number | null;
  presets: Preset[];
  stats: StepsStats;
  formattedSteps: string;
  handleSlider: (val: number) => void;
  handlePreset: (val: number) => void;
  saveMutation: UseMutationResult<any, Error, number, unknown>;
}

function calcStats(steps: number): StepsStats {
  return {
    distance: (steps * 0.00075).toFixed(1),
    calories: Math.round(steps * 0.04),
    time: Math.round(steps / 100),
  };
}

export function useStepsGoal(initialSteps = 8000): UseStepsGoalReturn {
  const user = useAuthStore(s => s.user);
  const updateUser = useAuthStore(s => s.updateUser);

  // If a pending goal already exists, start the slider at that value
  const startValue = user?.pendingStepGoal ?? initialSteps;
  const [steps, setSteps] = useState(startValue);
  const [activePreset, setActivePreset] = useState<number | null>(startValue);
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async (dailyStepGoal: number) => {
      const res = await api.patch<{ data: any }>('user/step-goal', { dailyStepGoal });
      return res.data;
    },
    onSuccess: (data) => {
      if (user) {
        // Store pending goal info — today's active goal stays unchanged
        updateUser({
          pendingStepGoal: data.pendingStepGoal,
          pendingGoalEffectiveDate: data.pendingGoalEffectiveDate,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    },
  });

  const handleSlider = useCallback((val: number) => {
    const rounded = Math.max(3000, Math.round(val / 500) * 500);
    setSteps(rounded);
    const match = PRESETS.find((p) => p.value === rounded);
    setActivePreset(match ? rounded : null);
  }, []);

  const handlePreset = useCallback((val: number) => {
    setSteps(val);
    setActivePreset(val);
  }, []);

  return {
    steps,
    activePreset,
    presets: PRESETS,
    stats: calcStats(steps),
    formattedSteps: steps.toLocaleString(),
    handleSlider,
    handlePreset,
    saveMutation,
  };
}
