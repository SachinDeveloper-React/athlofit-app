// src/components/AppText.tsx

import React from 'react';
import {
  Text,
  TextStyle,
  StyleProp,
  TextProps as RNTextProps,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { FontSize, FontWeight, LetterSpacing } from '../constants/typography';

// ─── Types ────────────────────────────────────────────────────────────────────

type Variant =
  | 'largeTitle' // 34 bold  — screen hero titles
  | 'title1' // 28 bold
  | 'title2' // 26 semiBold
  | 'title3' // 22 semiBold
  | 'headline' // 17 semiBold
  | 'body' // 16 regular
  | 'callout' // 16 regular (slightly muted)
  | 'subhead' // 15 regular
  | 'footnote' // 13 regular
  | 'caption1' // 12 regular
  | 'caption2' // 11 regular
  | 'label' // 14 medium
  | 'overline'; // 11 semiBold uppercase

interface AppTextProps extends RNTextProps {
  variant?: Variant;
  weight?: keyof typeof FontWeight;
  color?: string;
  align?: TextStyle['textAlign'];
  secondary?: boolean; // shorthand for mutedForeground color
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

// ─── Component ────────────────────────────────────────────────────────────────

const AppText: React.FC<AppTextProps> = ({
  variant = 'body',
  weight,
  color,
  align,
  secondary = false,
  children,
  style,
  ...rest
}) => {
  const { colors, fontSize, fontWeight } = useTheme();

  const variantStyle = getVariantStyle(
    variant,
    colors.foreground,
    colors.mutedForeground,
  );

  const composed: StyleProp<TextStyle> = [
    variantStyle,
    weight && { fontWeight: fontWeight[weight] },
    color && { color },
    secondary && { color: colors.mutedForeground },
    align && { textAlign: align },
    style,
  ];

  return (
    <Text style={composed} {...rest}>
      {children}
    </Text>
  );
};

// ─── Variant map ──────────────────────────────────────────────────────────────

function getVariantStyle(
  variant: Variant,
  fg: string,
  muted: string,
): TextStyle {
  switch (variant) {
    case 'largeTitle':
      return {
        fontSize: FontSize['5xl'],
        fontWeight: FontWeight.bold,
        letterSpacing: LetterSpacing.tight,
        color: fg,
      };
    case 'title1':
      return {
        fontSize: FontSize['4xl'],
        fontWeight: FontWeight.bold,
        letterSpacing: LetterSpacing.tight,
        color: fg,
      };
    case 'title2':
      return {
        fontSize: FontSize['3xl'],
        fontWeight: FontWeight.semiBold,
        letterSpacing: LetterSpacing.tight,
        color: fg,
      };
    case 'title3':
      return {
        fontSize: FontSize['2xl'],
        fontWeight: FontWeight.semiBold,
        letterSpacing: LetterSpacing.normal,
        color: fg,
      };
    case 'headline':
      return {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.semiBold,
        letterSpacing: LetterSpacing.normal,
        color: fg,
      };
    case 'body':
      return {
        fontSize: FontSize.base,
        fontWeight: FontWeight.regular,
        letterSpacing: LetterSpacing.normal,
        color: fg,
      };
    case 'callout':
      return {
        fontSize: FontSize.base,
        fontWeight: FontWeight.regular,
        letterSpacing: LetterSpacing.normal,
        color: muted,
      };
    case 'subhead':
      return {
        fontSize: FontSize.md,
        fontWeight: FontWeight.regular,
        letterSpacing: LetterSpacing.normal,
        color: fg,
      };
    case 'footnote':
      return {
        fontSize: FontSize.sm + 1,
        fontWeight: FontWeight.regular,
        letterSpacing: LetterSpacing.normal,
        color: muted,
      };
    case 'caption1':
      return {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.regular,
        letterSpacing: LetterSpacing.normal,
        color: muted,
      };
    case 'caption2':
      return {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.regular,
        letterSpacing: LetterSpacing.normal,
        color: muted,
      };
    case 'label':
      return {
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
        letterSpacing: LetterSpacing.normal,
        color: fg,
      };
    case 'overline':
      return {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semiBold,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: muted,
      };
  }
}

export default AppText;

// ─── Usage ────────────────────────────────────────────────────────────────────
// <AppText variant="largeTitle">Good Morning</AppText>
// <AppText variant="headline">Today's Steps</AppText>
// <AppText variant="body" secondary>Tap to view details</AppText>
// <AppText variant="caption1" color={colors.primary}>View all</AppText>
