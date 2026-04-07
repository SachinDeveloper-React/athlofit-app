import { memo, useMemo } from 'react';
import { useAccountStyles } from './useAccountStyles';
import { Pressable } from 'react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { MenuRow } from '../../types/account.types';
import { AppText, AppView, Icon } from '../../../../components';
import { withOpacity } from '../../../../utils/withOpacity';

export const AccountSettingsRow = memo(({ item }: { item: MenuRow }) => {
  const { colors } = useTheme();
  const s = useMemo(() => useAccountStyles(colors), [colors]);

  const { bg, fg } = useMemo(() => {
    const base =
      item.tint === 'blue'
        ? colors.primary
        : item.tint === 'purple'
        ? colors.chart?.c2 ?? colors.primary
        : item.tint === 'yellow'
        ? colors.warning ?? colors.primary
        : colors.destructive;

    return {
      bg: withOpacity(base, 0.12),
      fg: base,
    };
  }, [item.tint, colors]);

  return (
    <Pressable onPress={item.onPress} style={s.rowPress} hitSlop={6}>
      <AppView style={s.row}>
        <AppView style={[s.rowIconWrap, { backgroundColor: bg }]}>
          <item.icon size={18} color={fg} />
        </AppView>

        <AppText style={s.rowTitle}>{item.title}</AppText>

        <AppView style={s.rowRight}>
          {typeof item.badge === 'number' && item.badge > 0 && (
            <AppView style={s.badge}>
              <AppText style={s.badgeText}>{item.badge}</AppText>
            </AppView>
          )}
          <Icon
            name="ChevronRight"
            size={18}
            color={withOpacity(colors.foreground, 0.35)}
          />
        </AppView>
      </AppView>
    </Pressable>
  );
});
