// src/components/Badge.tsx

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import AppText from './AppText';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius } from '../constants/spacing';

type BadgeVariant = 'dot' | 'count' | 'pill';
type BadgeTone = 'primary' | 'success' | 'warning' | 'destructive' | 'muted';

interface BadgeProps {
  variant?: BadgeVariant;
  tone?: BadgeTone;
  count?: number;
  label?: string;
  maxCount?: number;
  style?: StyleProp<ViewStyle>;
}

const Badge: React.FC<BadgeProps> = ({
  variant = 'count',
  tone = 'destructive',
  count = 0,
  label,
  maxCount = 99,
  style,
}) => {
  const { colors } = useTheme();

  const toneMap: Record<BadgeTone, { bg: string; text: string }> = {
    primary: { bg: colors.primary, text: colors.primaryForeground },
    success: { bg: colors.success, text: '#FFFFFF' },
    warning: { bg: colors.warning, text: '#FFFFFF' },
    destructive: { bg: colors.destructive, text: colors.destructiveForeground },
    muted: { bg: colors.muted, text: colors.mutedForeground },
  };

  const { bg, text } = toneMap[tone];

  if (variant === 'dot') {
    return <View style={[styles.dot, { backgroundColor: bg }, style]} />;
  }

  const display =
    variant === 'count'
      ? count > maxCount
        ? `${maxCount}+`
        : String(count)
      : label ?? '';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          paddingHorizontal: display.length > 2 ? Spacing[1.5] : Spacing[1],
        },
        style,
      ]}
    >
      <AppText variant="caption2" weight="bold" color={text}>
        {display}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Badge;
