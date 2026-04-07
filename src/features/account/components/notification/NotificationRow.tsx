import { memo, useCallback, useMemo } from 'react';
import { Pressable, ViewStyle } from 'react-native';
import { NotificationItem } from '../../types/notification.types';
import { useTheme } from '../../../../hooks/useTheme';
import { useNotificationStyles } from '../../styles/useNotificationStyles';
import { iconFor, timeAgo } from '../../service/notificationService';
import { AppText, AppView, Card } from '../../../../components';
import { withOpacity } from '../../../../utils/withOpacity';

export const NotificationRow = memo(
  ({
    item,
    onPress,
    style,
  }: {
    item: NotificationItem;
    onPress?: (item: NotificationItem) => void;
    style?: ViewStyle;
  }) => {
    const { colors } = useTheme();
    const s = useMemo(() => useNotificationStyles(colors), [colors]);
    const Icon = iconFor(item.type);

    const accent = useMemo(() => {
      if (item.type === 'SECURITY') return colors.success ?? colors.primary;
      if (item.type === 'HEART') return colors.destructive;
      return colors.primary;
    }, [item.type, colors]);

    const onRowPress = useCallback(() => onPress?.(item), [item, onPress]);

    return (
      <Pressable onPress={onRowPress}>
        <Card style={[s.rowCard, style]}>
          <AppView style={s.rowLeft}>
            <AppView
              style={[
                s.iconBubble,
                { backgroundColor: withOpacity(accent, 0.12) },
              ]}
            >
              <Icon size={18} color={accent} />
            </AppView>

            <AppView style={s.textCol}>
              <AppText style={s.title} numberOfLines={1}>
                {item.title}
              </AppText>
              <AppText style={s.message} numberOfLines={2}>
                {item.message}
              </AppText>
            </AppView>
          </AppView>

          <AppText style={s.time} numberOfLines={1}>
            {timeAgo(item.createdAt)}
          </AppText>
        </Card>
      </Pressable>
    );
  },
);
