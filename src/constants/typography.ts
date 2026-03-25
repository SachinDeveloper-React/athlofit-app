// src/constants/typography.ts
import { Platform } from 'react-native';

// iOS-native feel: SF Pro Text / SF Pro Display
export const FontFamily = {
  regular: Platform.select({ ios: 'System', android: 'Roboto' })!,
  medium: Platform.select({ ios: 'System', android: 'Roboto-Medium' })!,
  semiBold: Platform.select({ ios: 'System', android: 'Roboto-Medium' })!,
  bold: Platform.select({ ios: 'System', android: 'Roboto-Bold' })!,
  mono: Platform.select({ ios: 'Menlo', android: 'monospace' })!,
} as const;

// iOS Dynamic Type scale
export const FontSize = {
  xs: 11,
  sm: 12,
  md: 14,
  base: 16, // iOS body
  lg: 17, // iOS headline
  xl: 20,
  '2xl': 22, // iOS title3
  '3xl': 26, // iOS title2
  '4xl': 28, // iOS title1
  '5xl': 34, // iOS largeTitle
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
};

// iOS letter spacing values
export const LetterSpacing = {
  tight: -0.4,
  normal: 0,
  wide: 0.4,
} as const;
