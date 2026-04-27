// src/hooks/makeStyles.ts
// ─────────────────────────────────────────────────────────────────────────────
// Factory that turns a theme-aware style creator into a cached hook.
//
// Usage:
//   const useStyles = makeStyles(({ colors, spacing, radius, fontSize, fontWeight, shadow }) => ({
//     container: { backgroundColor: colors.background, padding: spacing[4] },
//     title:     { fontSize: fontSize['4xl'], fontWeight: fontWeight.bold },
//   }));
//
//   // Inside component:
//   const styles = useStyles();
//
// The result is memoised per theme instance — styles are only recomputed when
// the theme actually changes (e.g. dark ↔ light switch).

import { useMemo } from 'react';
import { useTheme, type Theme } from './useTheme';

type StyleCreator<T> = (theme: Theme) => T;

export function makeStyles<T extends Record<string, any>>(
  creator: StyleCreator<T>,
): () => T {
  return function useStyles(): T {
    const theme = useTheme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useMemo(() => creator(theme), [theme.isDark]);
  };
}
