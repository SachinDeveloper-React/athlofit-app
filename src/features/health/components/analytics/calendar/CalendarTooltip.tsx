// src/features/health/components/analytics/calendar/CalendarTooltip.tsx
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText } from '../../../../../components';
import type { ThemeColors } from '../../../../../constants/colors';
import type { CalendarDay } from '../../../types/calendar.types';

interface Props {
  day: CalendarDay;
  goal: number;
  colors: ThemeColors;
}

const CalendarTooltip = memo(({ day, goal, colors }: Props) => {
  const pct     = goal > 0 ? Math.min(100, Math.round((day.steps / goal) * 100)) : 0;
  const dateObj = new Date(day.date + 'T00:00:00');
  const label   = dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      style={[styles.tooltip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
    >
      <AppText variant="caption1" weight="semiBold" style={{ color: colors.foreground }}>
        {label}
      </AppText>

      <View style={styles.row}>
        <AppText variant="caption2" style={{ color: colors.mutedForeground }}>Steps: </AppText>
        <AppText variant="caption2" weight="semiBold" style={{ color: colors.foreground }}>
          {day.steps.toLocaleString()}
        </AppText>
        <AppText variant="caption2" style={{ color: colors.mutedForeground }}>
          {' '}/ {goal.toLocaleString()}
        </AppText>
      </View>

      <View style={styles.row}>
        <AppText variant="caption2" style={{ color: colors.mutedForeground }}>Progress: </AppText>
        <AppText
          variant="caption2"
          weight="semiBold"
          style={{ color: day.goalMet ? colors.success : colors.primary }}
        >
          {pct}%{day.goalMet ? '  ✓ Goal met!' : ''}
        </AppText>
      </View>
    </Animated.View>
  );
});

CalendarTooltip.displayName = 'CalendarTooltip';
export default CalendarTooltip;

const styles = StyleSheet.create({
  tooltip: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 4,
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
});
