import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { mmkvStorage } from '../../../store';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingState {
  hasFinished: boolean;
  currentSlide: number;
  finishOnboarding: () => void;
  setSlide: (index: number) => void;
  reset: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    immer(set => ({
      hasFinished: false,
      currentSlide: 0,

      finishOnboarding: () =>
        set(state => {
          state.hasFinished = true;
        }),

      setSlide: (index: number) =>
        set(state => {
          state.currentSlide = index;
        }),

      reset: () =>
        set(state => {
          state.hasFinished = false;
          state.currentSlide = 0;
        }),
    })),
    {
      name: 'onboarding-store',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
