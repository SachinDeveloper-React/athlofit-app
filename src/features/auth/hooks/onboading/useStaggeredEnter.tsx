// ─── useStaggeredEnter ─────────────────────────────────────────────────────
// Returns an array of Animated.Values, each entering with a staggered delay.

import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

export function useStaggeredEnter(
  count: number,
  duration: number,
  staggerMs: number,
  useNativeDriver = false,
): Animated.Value[] {
  const anims = useRef<Animated.Value[]>(
    Array.from({ length: count }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration,
        delay: i * staggerMs,
        useNativeDriver,
      }),
    );
    Animated.parallel(animations).start();
    return () => animations.forEach(a => a.stop());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return anims;
}
