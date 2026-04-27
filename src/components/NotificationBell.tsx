// src/components/NotificationBell.tsx
import React, { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { AppView, AppText } from './index';
import { Bell } from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';
import { withOpacity } from '../utils/withOpacity';
import { useNotifications } from '../features/account/hooks/useNotifications';

type NotificationBellProps = {
  onPress?: () => void;
  size?: number;
  iconColor?: string;
  badgeColor?: string;
  showBadge?: boolean;
};

export const NotificationBell = memo(
  ({
    onPress,
    size = 20,
    iconColor,
    badgeColor,
    showBadge = true,
  }: NotificationBellProps) => {
    const { colors } = useTheme();
    const { data } = useNotifications();
    const unreadCount = data?.unreadCount ?? 0;

    const finalIconColor = iconColor || colors.foreground;
    const finalBadgeColor = badgeColor || colors.destructive;

    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.container,
          { transform: [{ scale: pressed ? 0.95 : 1 }] },
        ]}
      >
        <AppView style={styles.iconWrapper}>
          <Bell size={size} color={finalIconColor} strokeWidth={2} />
          
          {showBadge && unreadCount > 0 && (
            <AppView
              style={[
                styles.badge,
                { backgroundColor: finalBadgeColor },
              ]}
            >
              <AppText style={styles.badgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </AppText>
            </AppView>
          )}
        </AppView>
      </Pressable>
    );
  },
);

NotificationBell.displayName = 'NotificationBell';

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  iconWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 12,
  },
});
