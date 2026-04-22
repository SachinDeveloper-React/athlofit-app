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
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

export const CoinBadge = memo(({ balance: balanceProp, size = 'md' }: Props) => {
  const { colors } = useTheme();
  const storeBalance = useGamificationStore(s => s.coinsBalance);
  const balance = balanceProp ?? storeBalance;

  // Pulse animation when balance changes
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

  return (
    <Animated.View
      style={[
        styles.badge,
        isSmall && styles.badgeSm,
        {
          backgroundColor: withOpacity('#F5C518', 0.15),
          borderColor: withOpacity('#F5C518', 0.35),
        },
        animStyle,
      ]}
    >
      <Icon name="HandCoins" size={isSmall ? 13 : 15} color={colors.gold} />
      <AppText style={[styles.count, isSmall && styles.countSm]}>
        {formatCoins(balance)}
      </AppText>
    </Animated.View>
  );
});

CoinBadge.displayName = 'CoinBadge';

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeSm: {
    height: 26,
    paddingHorizontal: 8,
  },
  count: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F5C518',
    letterSpacing: 0.3,
    lineHeight: 20,
    includeFontPadding: false,
  },
  countSm: {
    fontSize: 11,
    lineHeight: 16,
  },
});
