import {
  CoinsScene,
  EcomScene,
  HeartScene,
  HydrationScene,
  StepsScene,
} from '../components/onboarding';
// ─── SLIDES ───────────────────────────────────────────────────────────────
// Scenes are imported lazily in slides.ts to avoid a circular dependency.

import { SlideConfig } from '../types/onboarding.types';
import { C } from './onboarding.constant';

export const SLIDES: SlideConfig[] = [
  {
    key: 'steps',
    title: '🚶 Walk. Earn. Repeat.',
    subtitle:
      'Every step counts. Turn your daily movement into ATHLOFIT Coins and start earning rewards.',
    accent: C.teal,
    Scene: StepsScene,
    button: "Start Walking"
  },
  {
    key: 'coins',
    title: '🪙 Your Steps Have Value',
    subtitle:
      'Walk, run, stay active and earn ATHLOFIT Coins every day. Fitness finally pays back.',
    accent: C.gold,
    Scene: CoinsScene,
    button:"Earn Coins"
  },
  {
    key: 'hydration',
    title: 'Stay Hydrated',
    subtitle:
      'Track your water intake and stay hydrated throughout the day for peak performance.',
    accent: C.blue,
    Scene: HydrationScene,
    button:"Drink Water"
  },
  {
    key: 'heart',
    title: '❤️ Track Your Health',
    subtitle:
      'Monitor steps, heart rate, BMI and other health insights in one place.',
    accent: C.accent,
    Scene: HeartScene,
    button:"Stay Healthy"
  },
  {
    key: 'ecom',
    title: '🏆 Challenge Yourself',
    subtitle:
      'Build streaks, climb leaderboards and compete with friends to stay motivated and shop.',
    accent: C.teal,
    Scene: EcomScene,
    button:"Get Started"
  },
];
