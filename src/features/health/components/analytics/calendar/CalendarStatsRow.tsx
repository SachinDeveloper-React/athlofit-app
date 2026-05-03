// src/features/health/components/analytics/calendar/CalendarStatsRow.tsx
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { CheckCircle2, Flame } from 'lucide-react-native';
import { AppText } from '../../../../../components';
import { withOpacity } from '../../../../../utils/withOpacity';
import type { ThemeColors } from '../../../../../constants/colors';
import type { CalendarActivityResponse } from '../../../types/calendar.types';

interface Props {
  data: CalendarActivityResponse;
  colors: ThemeColors;
}

const CalendarStatsRow = memo(({ data, colors }: Props) => {
  const completionPct = data.totalDays > 0
    ? Math.round((data.completedDays / data.totalDays) * 100)
    : 0;

  return (
    <View style={[styles.row, { backgroundColor: withOpacity(colors.primary, 0.06) }]}>
      <StatItem colors={colors}>
        <View style={styles.iconRow}>
          <CheckCircle2 size={13} color={colors.success} />
          <AppText variant="caption1" weight="bold" style={{ color: colors.success, marginLeft: 3 }}>
            {data.completedDays}
          </AppText>
        </View>
        <AppText variant="caption2" style={{ color: colors.mutedForeground, marginTop: 2 }}>
          Goal days
        </AppText>
      </StatItem>

      <Divider colors={colors} />

      <StatItem colors={colors}>
        <View style={styles.iconRow}>
          <Flame size={13} color={colors.primary} />
          <AppText variant="caption1" weight="bold" style={{ color: colors.primary, marginLeft: 3 }}>
            {data.activeDays}
          </AppText>
        </View>
        <AppText variant="caption2" style={{ color: colors.mutedForeground, marginTop: 2 }}>
          Active days
        </AppText>
      </StatItem>

      <Divider colors={colors} />

      <StatItem colors={colors}>
        <AppText variant="caption1" weight="bold" style={{ color: colors.foreground }}>
          {data.totalDays}
        </AppText>
        <AppText variant="caption2" style={{ color: colors.mutedForeground, marginTop: 2 }}>
          Total days
        </AppText>
      </StatItem>

      <Divider colors={colors} />

      <StatItem colors={colors}>
        <AppText variant="caption1" weight="bold" style={{ color: colors.foreground }}>
          {completionPct}%
        </AppText>
        <AppText variant="caption2" style={{ color: colors.mutedForeground, marginTop: 2 }}>
          Completion
        </AppText>
      </StatItem>
    </View>
  );
});

CalendarStatsRow.displayName = 'CalendarStatsRow';
export default CalendarStatsRow;

// ─── Internal helpers ─────────────────────────────────────────────────────────

const StatItem = memo(({ children, colors }: { children: React.ReactNode; colors: ThemeColors }) => (
  <View style={styles.item}>{children}</View>
));
StatItem.displayName = 'StatItem';

const Divider = memo(({ colors }: { colors: ThemeColors }) => (
  <View style={[styles.divider, { backgroundColor: colors.border }]} />
));
Divider.displayName = 'Divider';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 30,
    marginHorizontal: 4,
  },
});
