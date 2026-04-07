import { Platform, Pressable, Switch } from 'react-native';
import { memo, useMemo } from 'react';
import { Row } from '../../types/setting.types';
import { useTheme } from '../../../../hooks/useTheme';
import { AppText, AppView } from '../../../../components';
import { withOpacity } from '../../../../utils/withOpacity';
import { ChevronRight } from 'lucide-react-native';
import { useSettingStyles } from '../../styles/useSettingStyles';

export const SettingsRow = memo(
  ({
    row,
    isFirst,
    isLast,
  }: {
    row: Row;
    isFirst: boolean;
    isLast: boolean;
  }) => {
    const { colors, radius } = useTheme();
    const s = useMemo(() => useSettingStyles(colors), [colors]);
    const Icon = row.icon;

    const iconColor =
      row.iconColorKey === 'secondary'
        ? colors.secondary
        : row.iconColorKey === 'destructive'
        ? colors.destructive
        : row.iconColorKey === 'foreground'
        ? colors.foreground
        : colors.primary;

    const onPress = row.type === 'nav' ? row.onPress : undefined;

    return (
      <Pressable
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [
          s.row,
          !isLast && s.rowDivider,
          (isFirst || isLast) && { borderRadius: radius.sm },
          pressed && onPress ? s.rowPressed : null,
        ]}
      >
        <AppView style={s.left}>
          <AppView style={s.iconWrap}>
            <Icon size={20} color={iconColor} />
          </AppView>
          <AppView style={s.main_title}>
            <AppText style={s.title}>{row.title}</AppText>
            {row.type !== 'toggle' && row.valueText ? (
              <AppText numberOfLines={1} style={s.valueText}>
                {row.valueText}
              </AppText>
            ) : null}
          </AppView>
        </AppView>

        <AppView style={s.right}>
          {row.type === 'toggle' ? (
            <Switch
              value={row.value}
              onValueChange={row.onValueChange}
              trackColor={{
                false: withOpacity(colors.foreground, 0.12),
                true: withOpacity(colors.primary, 0.35),
              }}
              thumbColor={row.value ? colors.primary : colors.card}
              ios_backgroundColor={withOpacity(colors.foreground, 0.12)}
              style={Platform.select({
                ios: { transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] },
                android: { transform: [{ scaleX: 1.0 }, { scaleY: 1.0 }] },
              })}
            />
          ) : (
            <AppView style={s.navRight}>
              <ChevronRight
                size={18}
                color={withOpacity(colors.foreground, 0.35)}
              />
            </AppView>
          )}
        </AppView>
      </Pressable>
    );
  },
);
