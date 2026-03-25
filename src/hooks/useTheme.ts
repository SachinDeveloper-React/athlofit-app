// src/hooks/useTheme.ts
//
// Returns the correct color palette based on the system color scheme.
// All components use this hook — no hardcoded colors anywhere.

import { useColorScheme } from 'react-native';
import { lightColors, darkColors, type ThemeColors } from '../constants/colors';
import { Spacing, Radius, Shadow } from '../constants/spacing';
import { FontFamily, FontSize, FontWeight } from '../constants/typography';

export interface Theme {
  colors: ThemeColors;
  spacing: typeof Spacing;
  radius: typeof Radius;
  shadow: typeof Shadow;
  fontFamily: typeof FontFamily;
  fontSize: typeof FontSize;
  fontWeight: typeof FontWeight;
  isDark: boolean;
}

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  return {
    colors: isDark ? darkColors : lightColors,
    spacing: Spacing,
    radius: Radius,
    shadow: Shadow,
    fontFamily: FontFamily,
    fontSize: FontSize,
    fontWeight: FontWeight,
    isDark,
  };
}
