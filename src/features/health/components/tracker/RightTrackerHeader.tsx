import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import {
  AppText,
  AppView,
  Avatar,
  CoinBadge,
  Icon,
  IconButton,
} from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_URI =
  'https://plus.unsplash.com/premium_photo-1673458333581-c2bfab6f0f69?q=80&w=2070';

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  onActivityPress?: () => void;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
  onCoinPress?: () => void;
  avatarUri?: string;
  avatarName?: string;
};

const RightTrackerHeader = memo(
  ({
    onActivityPress,
    onNotificationPress,
    onProfilePress,
    onCoinPress,
    avatarUri = AVATAR_URI,
    avatarName = AVATAR_URI,
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
          <Avatar
            uri={avatarUri || undefined}
            name={avatarName}
            size="sm"
            shape="rounded"
          />
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
});
