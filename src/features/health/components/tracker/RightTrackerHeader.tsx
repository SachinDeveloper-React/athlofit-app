import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { AppText, AppView, Avatar, IconButton } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { useGamificationStore } from '../../store/gamificationStore';

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_URI =
  'https://plus.unsplash.com/premium_photo-1673458333581-c2bfab6f0f69?q=80&w=2070';

// ─── Coin Badge ───────────────────────────────────────────────────────────────

const CoinBadge = memo(() => {
  const coinsBalance = useGamificationStore(s => s.coinsBalance);

  const bg = withOpacity('#F5C518', 0.15);

  return (
    <AppView
      style={[
        styles.coinBadge,
        { backgroundColor: bg, borderColor: withOpacity('#F5C518', 0.35) },
      ]}
    >
      <AppText style={styles.coinEmoji}>🪙</AppText>
      <AppText style={styles.coinCount}>
        {coinsBalance >= 1000
          ? `${(coinsBalance / 1000).toFixed(1)}k`
          : coinsBalance.toString()}
      </AppText>
    </AppView>
  );
});

CoinBadge.displayName = 'CoinBadge';

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  onActivityPress?: () => void;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
  onCoinPress?: () => void;
  avatarUri?: string;
};

const RightTrackerHeader = memo(
  ({
    onActivityPress,
    onNotificationPress,
    onProfilePress,
    onCoinPress,
    avatarUri = AVATAR_URI,
  }: Props) => {
    const { colors, radius } = useTheme();

    const handleActivity = useCallback(() => {
      onActivityPress?.();
    }, [onActivityPress]);

    const handleNotification = useCallback(() => {
      onNotificationPress?.();
    }, [onNotificationPress]);
    const handleProfile = useCallback(() => {
      onProfilePress?.();
    }, [onProfilePress]);
    const handleCoins = useCallback(() => {
      onCoinPress?.();
    }, [onCoinPress]);

    return (
      <AppView style={styles.row}>
        <Pressable
          onPress={handleCoins}
          style={({ pressed }) => ({
            transform: [{ scale: pressed ? 0.99 : 1 }],
          })}
        >
          <CoinBadge />
        </Pressable>
        <IconButton
          name="Activity"
          onPress={handleActivity}
          borderColor={colors.border}
          borderRadius={radius.full}
        />
        <IconButton
          name="BellDot"
          onPress={handleNotification}
          borderColor={colors.border}
          borderRadius={radius.full}
        />
        <Pressable
          onPress={handleProfile}
          style={({ pressed }) => ({
            transform: [{ scale: pressed ? 0.99 : 1 }],
          })}
        >
          <Avatar uri={avatarUri} size="sm" shape="rounded" />
        </Pressable>
      </AppView>
    );
  },
);

RightTrackerHeader.displayName = 'RightTrackerHeader';

export default RightTrackerHeader;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  coinEmoji: {
    fontSize: 13,
    lineHeight: 16,
  },
  coinCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F5C518',
    letterSpacing: 0.3,
  },
});
