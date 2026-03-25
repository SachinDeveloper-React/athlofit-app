import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';

// ─── useRunnerFrame ────────────────────────────────────────────────────────
// Ticks through 0-7 at ~14 fps using a setInterval.
// Only updates a single integer, so re-renders are minimal.

export function useRunnerFrame(): number {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame(f => (f + 1) % 8);
    }, 72);
    return () => clearInterval(id);
  }, []);

  return frame;
}
