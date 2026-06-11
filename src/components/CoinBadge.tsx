// src/components/CoinBadge.tsx
// Shared coin balance badge — reads live from gamificationStore.
// Used in TrackerScreen header and ShopScreen header.

import React, { memo, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { AppText, AppView, Icon } from './index';
import { useTheme } from '../hooks/useTheme';
import { withOpacity } from '../utils/withOpacity';
import { useGamificationStore } from '../features/health/store/gamificationStore';

interface Props {
  /** Override the balance (defaults to live store value) */
  balance?: number;
  size?: 'sm' | 'md';
}

function formatCoins(n: number): string {
  const format = (value: number, suffix: string) => {
    const fixed = parseFloat(value.toFixed(1));
    return `${Number.isInteger(fixed) ? fixed : fixed.toFixed(1)}${suffix}`;
  };

  if (n >= 10000000) return format(n / 10000000, 'Cr');
  if (n >= 100000)   return format(n / 100000,   'L');
  if (n >= 1000)     return format(n / 1000,     'k');

  // Always show 2 decimal places — 0.10, 0.95, 50.00
  return n.toFixed(2);
}

export const CoinBadge = memo(({ balance: balanceProp, size = 'md' }: Props) => {
  const { colors, spacing, radius, fontSize, fontWeight } = useTheme();
  const storeBalance = useGamificationStore(s => s.coinsBalance);
  const balance = balanceProp ?? storeBalance;

  const scale = useSharedValue(1);
  const prevBalance = useSharedValue(balance);

  useEffect(() => {
    if (balance !== prevBalance.value && prevBalance.value !== 0) {
      scale.value = withSequence(
        withSpring(1.15, { damping: 8, stiffness: 300 }),
        withTiming(1, { duration: 200 }),
      );
    }
    prevBalance.value = balance;
  }, [balance]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isSmall = size === 'sm';
  const height       = isSmall ? 26 : 32;
  const px           = isSmall ? spacing[2] : spacing[2.5];
  const iconSize     = isSmall ? 13 : 15;
  const textSize     = isSmall ? fontSize.xs : fontSize.sm;
  const borderRadius = radius.full;

  return (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          flexShrink: 0,
          flexWrap: 'nowrap',
          gap: spacing[1],
          paddingHorizontal: px,
          height,
          borderRadius,
          borderWidth: 1,
          backgroundColor: withOpacity(colors.gold, 0.15),
          borderColor: withOpacity(colors.gold, 0.35),
        },
        animStyle,
      ]}
    >
      <Icon name="HandCoins" size={iconSize} color={colors.gold} />
      <AppText
        numberOfLines={1}
        style={{
          fontSize: textSize,
          fontWeight: fontWeight.bold,
          color: colors.gold,
          letterSpacing: 0.3,
          lineHeight: height,
          includeFontPadding: false,
          flexShrink: 0,
        }}
      >
        {formatCoins(balance)}
      </AppText>
    </Animated.View>
  );
});

CoinBadge.displayName = 'CoinBadge';
