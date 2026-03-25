import React, { memo, useCallback } from 'react';
import { Image, StyleSheet } from 'react-native';
import { AppView, IconButton } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_URI =
  'https://plus.unsplash.com/premium_photo-1673458333581-c2bfab6f0f69?q=80&w=2070';

const AVATAR_SIZE = 26;
const AVATAR_RADIUS = 10;

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  onActivityPress?: () => void;
  onNotificationPress?: () => void;
  avatarUri?: string;
};

const RightTrackerHeader = memo(
  ({ onActivityPress, onNotificationPress, avatarUri = AVATAR_URI }: Props) => {
    const { colors, radius } = useTheme();

    const handleActivity = useCallback(() => {
      onActivityPress?.();
    }, [onActivityPress]);

    const handleNotification = useCallback(() => {
      onNotificationPress?.();
    }, [onNotificationPress]);

    return (
      <AppView style={styles.row}>
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
        <Image
          source={{ uri: avatarUri }}
          style={styles.avatar}
          resizeMode="cover"
        />
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
    gap: 16,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_RADIUS,
  },
});
