// src/features/health/components/analytics/most-active-day/PeakStatsRow.tsx
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { TrendingUp } from 'lucide-react-native';
import { AppText } from '../../../../../components';
import { withOpacity } from '../../../../../utils/withOpacity';
import type { ThemeColors } from '../../../../../constants/colors';

interface Props {
  peakSteps: number;
  totalSteps: number;
  avgSteps: number;
  colors: ThemeColors;
}

const PeakStatsRow = memo(({ peakSteps, totalSteps, avgSteps, colors }: Props) => (
  <View style={[styles.row, { backgroundColor: withOpacity(colors.primary, 0.06) }]}>
    <View style={styles.item}>
      <AppText variant="title3" weight="bold" style={{ color: colors.primary }}>
        {peakSteps.toLocaleString()}
      </AppText>
      <AppText variant="caption2" style={{ color: colors.mutedForeground, marginTop: 1 }}>
        Peak steps
      </AppText>
    </View>

    <View style={[styles.divider, { backgroundColor: colors.border }]} />

    <View style={styles.item}>
      <AppText variant="title3" weight="bold" style={{ color: colors.foreground }}>
        {totalSteps.toLocaleString()}
      </AppText>
      <AppText variant="caption2" style={{ color: colors.mutedForeground, marginTop: 1 }}>
        Week total
      </AppText>
    </View>

    <View style={[styles.divider, { backgroundColor: colors.border }]} />

    <View style={styles.item}>
      <View style={styles.avgRow}>
        <TrendingUp size={12} color={colors.success} />
        <AppText variant="title3" weight="bold" style={{ color: colors.foreground, marginLeft: 3 }}>
          {avgSteps.toLocaleString()}
        </AppText>
      </View>
      <AppText variant="caption2" style={{ color: colors.mutedForeground, marginTop: 1 }}>
        Daily avg
      </AppText>
    </View>
  </View>
));

PeakStatsRow.displayName = 'PeakStatsRow';
export default PeakStatsRow;

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
  avgRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    marginHorizontal: 4,
  },
});
