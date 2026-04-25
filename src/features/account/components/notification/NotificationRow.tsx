import React, { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { NotificationItem } from '../../types/notification.types';
import { useTheme } from '../../../../hooks/useTheme';
import { useNotificationStyles } from '../../styles/useNotificationStyles';
import { iconFor, timeAgo } from '../../service/notificationService';
import { AppText, AppView, Card } from '../../../../components';
import { withOpacity } from '../../../../utils/withOpacity';
import { Icon } from '../../../../components/Icon';

export const NotificationRow = memo(
  ({
    item,
    onPress,
    onDelete,
    style,
  }: {
    item: NotificationItem;
    onPress?: (item: NotificationItem) => void;
    onDelete?: (id: string) => void;
    style?: ViewStyle;
  }) => {
    const { colors } = useTheme();
    const s = useMemo(() => useNotificationStyles(colors), [colors]);
    const NotifIcon = iconFor(item.type);

    const accent = useMemo(() => {
      if (item.type === 'SECURITY')  return colors.success ?? colors.primary;
      if (item.type === 'HEART')     return colors.destructive;
      if (item.type === 'CHALLENGE') return '#8B5CF6';
      if (item.type === 'COIN')      return '#F5C518';
      if (item.type === 'PRODUCT')   return '#10B981';
      return colors.primary;
    }, [item.type, colors]);

    const onRowPress  = useCallback(() => onPress?.(item), [item, onPress]);
    const onDeletePress = useCallback(() => onDelete?.(item.id), [item.id, onDelete]);

    return (
      <Pressable onPress={onRowPress}>
        <Card
          style={[
            s.rowCard,
            style,
            !item.read && { borderLeftWidth: 3, borderLeftColor: accent },
          ]}
        >
          {/* Unread dot */}
          {!item.read && (
            <View style={[styles.unreadDot, { backgroundColor: accent }]} />
          )}

          <AppView style={s.rowLeft}>
            <AppView
              style={[s.iconBubble, { backgroundColor: withOpacity(accent, 0.12) }]}
            >
              <NotifIcon size={18} color={accent} />
            </AppView>

            <AppView style={s.textCol}>
              <AppText
                style={[s.title, !item.read && { color: colors.foreground }]}
                numberOfLines={1}
              >
                {item.title}
              </AppText>
              <AppText style={s.message} numberOfLines={2}>
                {item.message}
              </AppText>
            </AppView>
          </AppView>

          <View style={styles.rightCol}>
            <AppText style={s.time} numberOfLines={1}>
              {timeAgo(item.createdAt)}
            </AppText>
            {onDelete && (
              <TouchableOpacity
                onPress={onDeletePress}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.deleteBtn}
              >
                <Icon name="X" size={13} color={withOpacity(colors.foreground, 0.3)} />
              </TouchableOpacity>
            )}
          </View>
        </Card>
      </Pressable>
    );
  },
);

NotificationRow.displayName = 'NotificationRow';

const styles = StyleSheet.create({
  unreadDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 6,
    marginLeft: 8,
  },
  deleteBtn: {
    padding: 2,
  },
});
