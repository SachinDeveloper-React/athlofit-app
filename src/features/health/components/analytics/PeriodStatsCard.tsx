// src/features/health/components/analytics/PeriodStatsCard.tsx
import React, { memo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BarChart2 } from 'lucide-react-native';

import { AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { usePeriodStats } from '../../hooks/usePeriodStats';
import { PeriodRow } from './period-stats';

const PeriodStatsCard = memo(() => {
  const { colors } = useTheme();
  const { data, isLoading } = usePeriodStats();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const periods  = data?.periods ?? [];
  const maxSteps = Math.max(...periods.map(p => p.totalSteps), 1);

  return (
    <Animated.View entering={FadeInDown.delay(150).duration(400)}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: withOpacity(colors.primary, 0.12) }]}>
            <BarChart2 size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <AppText variant="headline" weight="semiBold" style={{ color: colors.foreground }}>
              Period Overview
            </AppText>
            <AppText variant="caption2" style={{ color: colors.mutedForeground, marginTop: 1 }}>
              Tap a period to see details
            </AppText>
          </View>
        </View>

        {/* ── Column headers ── */}
        <View style={styles.colHeaders}>
          <AppText variant="caption2" style={{ color: colors.mutedForeground, flex: 1 }}>
            Period
          </AppText>
          <AppText variant="caption2" style={{ color: colors.mutedForeground, textAlign: 'right' }}>
            Steps / Change
          </AppText>
        </View>

        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        {/* ── Loading ── */}
        {isLoading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={colors.primary} />
            <AppText variant="caption1" style={{ color: colors.mutedForeground, marginTop: 8 }}>
              Loading period data…
            </AppText>
          </View>
        )}

        {/* ── Period rows ── */}
        {!isLoading && periods.map((stat, i) => (
          <PeriodRow
            key={stat.days}
            stat={stat}
            index={i}
            isSelected={selectedIndex === i}
            onPress={() => setSelectedIndex(prev => (prev === i ? null : i))}
            maxSteps={maxSteps}
          />
        ))}

        {/* ── Footer ── */}
        {!isLoading && periods.length > 0 && (
          <AppText variant="caption2" style={[styles.footer, { color: colors.mutedForeground }]}>
            Change is vs the prior equivalent period
          </AppText>
        )}
      </View>
    </Animated.View>
  );
});

PeriodStatsCard.displayName = 'PeriodStatsCard';
export default PeriodStatsCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 4,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 6,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  footer: {
    textAlign: 'center',
    marginTop: 8,
    paddingBottom: 2,
  },
});
