// src/features/health/components/tracker/CoinBlockedBanner.tsx
//
// Small banner shown on the Tracker screen when the user's coin earnings
// are blocked due to fake step detection (anti-cheat penalty).

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import AppText from '../../../../components/AppText';
import { Icon } from '../../../../components/Icon';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { useGamificationStore } from '../../store/gamificationStore';

const CoinBlockedBanner = memo(() => {
  const { colors, spacing, radius } = useTheme();
  const coinBlocked = useGamificationStore(s => s.coinBlocked);

  // Don't show if not blocked or if block has expired (client-side expiry check)
  if (!coinBlocked?.blocked) return null;
  if (coinBlocked.blockedUntil && new Date(coinBlocked.blockedUntil) <= new Date()) return null;

  const blockedDate = coinBlocked.blockedUntil
    ? new Date(coinBlocked.blockedUntil).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOutUp.duration(200)}
      style={[
        styles.container,
        {
          backgroundColor: withOpacity(colors.destructive, 0.08),
          borderColor: withOpacity(colors.destructive, 0.2),
          marginBottom: spacing[3],
          borderRadius: radius.lg,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: withOpacity(colors.destructive, 0.12) }]}>
          <Icon name="Ban" size={16} color={colors.destructive} />
        </View>
        <View style={styles.textWrap}>
          <AppText variant="subhead" weight="semiBold" style={{ color: colors.destructive }}>
            Coin Earnings Blocked
          </AppText>
          <AppText variant="caption1" style={{ color: colors.mutedForeground, marginTop: 2 }}>
            Suspicious step activity detected. Coins blocked until {blockedDate} ({coinBlocked.daysRemaining} days remaining).
          </AppText>
        </View>
      </View>
    </Animated.View>
  );
});

CoinBlockedBanner.displayName = 'CoinBlockedBanner';
export default CoinBlockedBanner;

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
});
