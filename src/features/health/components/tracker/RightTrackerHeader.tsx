import React, { memo, useCallback } from 'react';
import { Pressable } from 'react-native';
import {
  AppText,
  AppView,
  Avatar,
  CoinBadge,
  Icon,
  IconButton,
  NotificationBell,
} from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { makeStyles } from '../../../../hooks/makeStyles';

const AVATAR_URI =
  'https://plus.unsplash.com/premium_photo-1673458333581-c2bfab6f0f69?q=80&w=2070';

type Props = {
  onActivityPress?: () => void;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
  onCoinPress?: () => void;
  avatarUri?: string;
  avatarName?: string;
};

const useStyles = makeStyles(({ colors, spacing }) => ({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2.5],
  },
}));

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
    const styles = useStyles();

    const handleActivity = useCallback(() => { onActivityPress?.(); }, [onActivityPress]);
    const handleNotification = useCallback(() => { onNotificationPress?.(); }, [onNotificationPress]);
    const handleProfile = useCallback(() => { onProfilePress?.(); }, [onProfilePress]);
    const handleCoins = useCallback(() => { onCoinPress?.(); }, [onCoinPress]);

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
        <NotificationBell
          onPress={handleNotification}
          size={20}
          iconColor={colors.foreground}
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
