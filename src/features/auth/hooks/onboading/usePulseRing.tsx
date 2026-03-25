// ─── usePulseRing ──────────────────────────────────────────────────────────
// Returns { scale, opacity } animated values for an expanding pulse ring.

import { Animated } from 'react-native';
import { useLoopAnim } from './useLoopAnim';

interface PulseRingValues {
  scale: Animated.AnimatedInterpolation<number>;
  opacity: Animated.AnimatedInterpolation<number>;
}

export function usePulseRing(
  period = 1200,
  delay = 0,
  maxScale = 2.8,
): PulseRingValues {
  const raw = useLoopAnim({
    initialValue: 0,
    steps: [
      { toValue: 1, duration: period },
      { toValue: 0, duration: 0 },
    ],
    delay,
  });

  const scale = raw.interpolate({
    inputRange: [0, 1],
    outputRange: [1, maxScale],
  });
  const opacity = raw.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 0],
  });

  return { scale, opacity };
}
