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
    title: 'Move Every Day',
    subtitle:
      'Track your runs, walks, and every step of your journey to a healthier you.',
    accent: C.teal,
    Scene: StepsScene,
  },
  {
    key: 'coins',
    title: 'Earn Coins',
    subtitle:
      'Every step counts. Walk, run, and complete goals to earn coins you can spend.',
    accent: C.gold,
    Scene: CoinsScene,
  },
  {
    key: 'hydration',
    title: 'Stay Hydrated',
    subtitle:
      'Track your water intake and stay hydrated throughout the day for peak performance.',
    accent: C.blue,
    Scene: HydrationScene,
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
    key: 'ecom',
    title: 'Spend Your Coins',
    subtitle:
      'Redeem your hard-earned coins for fitness gear, supplements, and exclusive rewards.',
    accent: C.teal,
    Scene: EcomScene,
  },
];
