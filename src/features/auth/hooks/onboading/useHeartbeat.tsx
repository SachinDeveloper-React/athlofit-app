// ─── useHeartbeat ─────────────────────────────────────────────────────────
// Returns a scale Animated.Value that mimics a realistic double-beat.

import { Animated } from 'react-native';
import { useLoopAnim } from './useLoopAnim';

export function useHeartbeat(): Animated.Value {
  return useLoopAnim({
    initialValue: 1,
    steps: [
      { toValue: 1.18, duration: 150 },
      { toValue: 0.96, duration: 150 },
      { toValue: 1.12, duration: 100 },
      { toValue: 1.0, duration: 600 },
    ],
  });
}
