import {
  GoalScene,
  HeartScene,
  NutritionScene,
  RunnerScene,
  SleepScene,
} from '../components/onboarding';
// ─── SLIDES ───────────────────────────────────────────────────────────────
// Scenes are imported lazily in slides.ts to avoid a circular dependency.

import { SlideConfig } from '../types/onboarding.types';
import { C } from './onboarding.constant';

export const SLIDES: SlideConfig[] = [
  {
    key: 'run',
    title: 'Move Every Day',
    subtitle:
      'Track your runs, walks, and every step of your journey to a healthier you.',
    accent: C.accent,
    Scene: RunnerScene,
  },
  {
    key: 'heart',
    title: 'Know Your Heart',
    subtitle:
      'Real-time heart rate and blood pressure monitoring, always at your fingertips.',
    accent: C.accent,
    Scene: HeartScene,
  },
  {
    key: 'sleep',
    title: 'Rest & Recover',
    subtitle:
      'Quality sleep is the foundation of peak performance. We watch over you at night.',
    accent: C.gold,
    Scene: SleepScene,
  },
  {
    key: 'nutrition',
    title: 'Fuel Your Body',
    subtitle:
      'Stay hydrated, hit your macros, and power through every challenge with smart nutrition.',
    accent: C.teal,
    Scene: NutritionScene,
  },
  {
    key: 'goals',
    title: 'Own Your Goals',
    subtitle:
      'Set targets, measure progress, celebrate wins. Your healthiest life starts now.',
    accent: C.teal,
    Scene: GoalScene,
  },
];
