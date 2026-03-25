import React, { memo, useCallback, useMemo } from 'react';
import {
  Pressable,
  type PressableProps,
  type PressableStateCallbackType,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { SCREEN_WIDTH } from '../../../utils/measure';
import { Icon, LucideName } from '../../../components/Icon';
import { useTheme } from '../../../hooks/useTheme';
import { withOpacity } from '../../../utils/withOpacity';
import { AppText, AppView, Card } from '../../../components';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MetricCardProps = PressableProps & {
  iconName: LucideName;
  iconColor: string;
  iconBg: string;

  value: string | number;
  valueSuffix?: string;
  label: string;
  unit?: string;

  width?: number;
  height?: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_WIDTH = SCREEN_WIDTH / 2 - 27;
const DEFAULT_HEIGHT = SCREEN_WIDTH * 0.35;

// ─── Component ────────────────────────────────────────────────────────────────

const MetricCard = memo(
  ({
    iconName,
    iconColor,
    iconBg,
    value,
    valueSuffix,
    label,
    unit,
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    style,
    ...rest
  }: MetricCardProps) => {
    const { colors } = useTheme();

    // Inline press feedback — stable reference, no recreation on re-render
    const pressStyle = useCallback(
      ({ pressed }: PressableStateCallbackType): ViewStyle => ({
        opacity: pressed ? 0.99 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      }),
      [],
    );

    const cardStyle = useMemo(
      () => [{ width, height }, styles.card],
      [width, height],
    );

    const iconWrapStyle = useMemo(
      () => [styles.iconWrap, { backgroundColor: iconBg }],
      [iconBg],
    );

    const muted = useMemo(
      () => withOpacity(colors.foreground, 0.6),
      [colors.foreground],
    );

    return (
      <Pressable style={pressStyle} {...rest}>
        <Card style={cardStyle}>
          {/* Left column */}
          <AppView style={styles.leftCol}>
            <AppView style={iconWrapStyle}>
              <Icon name={iconName} color={iconColor} />
            </AppView>

            <AppView>
              <AppView style={styles.valueRow}>
                <AppText variant="title3">{value}</AppText>

                {!!valueSuffix && (
                  <AppText
                    variant="caption2"
                    style={[styles.valueSuffix, { color: iconColor }]}
                  >
                    {valueSuffix}
                  </AppText>
                )}
              </AppView>

              <AppText style={[styles.label, { color: muted }]}>
                {label}
              </AppText>
            </AppView>
          </AppView>

          {/* Right column — unit label */}
          {!!unit && (
            <AppView style={styles.rightCol}>
              <AppText style={[styles.unit, { color: muted }]}>{unit}</AppText>
            </AppView>
          )}
        </Card>
      </Pressable>
    );
  },
);

MetricCard.displayName = 'MetricCard';

export default MetricCard;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  leftCol: {
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  rightCol: {
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  iconWrap: {
    alignSelf: 'flex-start',
    padding: 10,
    borderRadius: 999,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  valueSuffix: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
  unit: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});
