// ─── useEnterAnim ──────────────────────────────────────────────────────────
// Fires a one-shot timing animation to `toValue` on mount.

import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

interface UseEnterAnimOptions {
  toValue: number;
  duration: number;
  initialValue?: number;
  delay?: number;
  useNativeDriver?: boolean;
}

export function useEnterAnim({
  toValue,
  duration,
  initialValue = 0,
  delay = 0,
  useNativeDriver = false,
}: UseEnterAnimOptions): Animated.Value {
  const anim = useRef(new Animated.Value(initialValue)).current;

  useEffect(() => {
    const animation = Animated.timing(anim, {
      toValue,
      duration,
      delay,
      useNativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return anim;
}
