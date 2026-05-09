// src/features/health/components/analytics/period-stats/PeriodRow.tsx
import React, { memo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { TrendingDown, TrendingUp } from 'lucide-react-native';

import { AppText } from '../../../../../components';
import { useTheme } from '../../../../../hooks/useTheme';
import { withOpacity } from '../../../../../utils/withOpacity';
import {
  formatSteps,
  formatChange,
  pctChange,
} from '../../../utils/analyticsFormatters';
import type { PeriodStat } from '../../../types/periodStats.types';
import DetailItem from './DetailItem';

interface Props {
  stat: PeriodStat;
  index: number;
  isSelected: boolean;
  onPress: () => void;
  maxSteps: number;
}

const PeriodRow = memo(({ stat, index, isSelected, onPress, maxSteps }: Props) => {
  const { colors, isDark } = useTheme();
  const isPositive = stat.change >= 0;
  const hasData    = stat.totalSteps > 0;
  const fillRatio  = maxSteps > 0 ? stat.totalSteps / maxSteps : 0;
  const TrendIcon  = isPositive ? TrendingUp : TrendingDown;
  const trendColor = isPositive ? colors.success : colors.destructive;

  const scale    = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSpring(0.97, { damping: 15 }, () => { scale.value = withSpring(1); });
    onPress();
  };

  return (
    // Outer wrapper owns the entrance animation only
    <Animated.View entering={FadeInDown.delay(index * 80).duration(350)}>
      {/* Inner view owns the press-scale transform only */}
      <Animated.View style={animStyle}>
        {/* ── Row ── */}
        <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        style={[
          styles.row,
          {
            backgroundColor: isSelected
              ? isDark ? withOpacity(colors.primary, 0.12) : withOpacity(colors.primary, 0.06)
              : 'transparent',
            borderColor: isSelected ? withOpacity(colors.primary, 0.3) : colors.border,
          },
        ]}
      >
        {/* Left: pill + bar */}
        <View style={styles.left}>
          <View style={[styles.pill, { backgroundColor: isSelected ? colors.primary : withOpacity(colors.primary, 0.1) }]}>
            <AppText variant="caption1" weight="bold" style={{ color: isSelected ? '#fff' : colors.primary }}>
              {stat.label}
            </AppText>
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${Math.round(fillRatio * 100)}%`,
                  backgroundColor: isSelected ? colors.primary : withOpacity(colors.primary, 0.35),
                  minWidth: hasData ? 4 : 0,
                },
              ]}
            />
          </View>
        </View>

        {/* Right: steps + change */}
        <View style={styles.right}>
          <AppText variant="subhead" weight="bold" style={{ color: colors.foreground, textAlign: 'right' }}>
            {hasData ? formatSteps(stat.totalSteps) : '—'}
          </AppText>
          <AppText variant="caption2" style={{ color: colors.mutedForeground, textAlign: 'right' }}>
            total steps
          </AppText>
          {hasData && stat.prevTotal > 0 && (
            <View style={[styles.badge, { backgroundColor: withOpacity(trendColor, 0.12) }]}>
              <TrendIcon size={10} color={trendColor} />
              <AppText variant="caption2" weight="semiBold" style={{ color: trendColor, marginLeft: 3 }}>
                {formatChange(stat.change)}
              </AppText>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* ── Expanded detail ── */}
      {isSelected && hasData && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={[
            styles.detail,
            {
              backgroundColor: isDark ? withOpacity(colors.primary, 0.07) : withOpacity(colors.primary, 0.04),
              borderColor: withOpacity(colors.primary, 0.15),
            },
          ]}
        >
          <DetailItem
            label="Daily Average"
            value={`${formatSteps(Math.round(stat.totalSteps / stat.days))} steps`}
            colors={colors}
          />
          <View style={[styles.detailDivider, { backgroundColor: withOpacity(colors.primary, 0.15) }]} />
          <DetailItem
            label="vs Prior Period"
            value={stat.prevTotal > 0 ? pctChange(stat.change, stat.prevTotal) : 'No prior data'}
            valueColor={
              stat.prevTotal > 0
                ? stat.change >= 0 ? colors.success : colors.destructive
                : colors.mutedForeground
            }
            colors={colors}
          />
          <View style={[styles.detailDivider, { backgroundColor: withOpacity(colors.primary, 0.15) }]} />
          <DetailItem
            label="Prior Period"
            value={stat.prevTotal > 0 ? `${formatSteps(stat.prevTotal)} steps` : '—'}
            colors={colors}
          />
        </Animated.View>
      )}
    </Animated.View>
    </Animated.View>
  );
});

PeriodRow.displayName = 'PeriodRow';
export default PeriodRow;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginVertical: 3,
    gap: 12,
  },
  left: { flex: 1, gap: 8 },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  right: { alignItems: 'flex-end', gap: 3, minWidth: 80 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 2,
  },
  detail: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 4,
    marginBottom: 4,
    paddingVertical: 4,
  },
  detailDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
});
