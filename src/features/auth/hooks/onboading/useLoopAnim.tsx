// ─── useLoopAnim ───────────────────────────────────────────────────────────
// Creates an Animated.Value and starts a looping sequence immediately.
// Returns the value so callers can derive interpolations from it.

import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

interface LoopStep {
  toValue: number;
  duration: number;
}

interface UseLoopAnimOptions {
  initialValue: number;
  steps: LoopStep[];
  /** If true the driver runs on the JS thread (needed for layout props like `width`). */
  useNativeDriver?: boolean;
  /** Delay before the loop starts, in ms. */
  delay?: number;
}

export function useLoopAnim({
  initialValue,
  steps,
  useNativeDriver = true,
  delay = 0,
}: UseLoopAnimOptions): Animated.Value {
  const anim = useRef(new Animated.Value(initialValue)).current;

  useEffect(() => {
    const sequence = Animated.loop(
      Animated.sequence(
        steps.map(({ toValue, duration }) =>
          Animated.timing(anim, { toValue, duration, useNativeDriver }),
        ),
      ),
    );

    if (delay > 0) {
      const timer = setTimeout(() => sequence.start(), delay);
      return () => {
        clearTimeout(timer);
        sequence.stop();
      };
    }

    sequence.start();
    return () => sequence.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return anim;
}
