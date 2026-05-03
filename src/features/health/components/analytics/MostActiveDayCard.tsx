// src/features/health/components/analytics/MostActiveDayCard.tsx
import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Trophy } from 'lucide-react-native';

import { AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { toDayLabel } from '../../utils/analyticsFormatters';
import { useWeeklySteps } from '../../hooks/useWeeklySteps';
import type { MostActiveDayData } from '../../types/mostActiveDay.types';

import { WeekBarChart, CHART_HEIGHT, PeakStatsRow } from './most-active-day';

// ─── Derive peak data from raw weekly steps ───────────────────────────────────

function derivePeakData(weekData: { date: string; fullDate?: string; steps: number }[] | undefined): MostActiveDayData {
  const raw = weekData ?? [];
  const entries = raw.map(e => ({
    date:     e.fullDate ?? e.date,   // prefer YYYY-MM-DD for navigation
    steps:    e.steps,
    dayLabel: e.date.length === 3 ? e.date : toDayLabel(e.date),
  }));

  if (!entries.length) {
    return { entries: [], peakIndex: -1, peakEntry: null, totalSteps: 0, avgSteps: 0 };
  }

  let peakIndex = 0;
  entries.forEach((e, i) => {
    if (e.steps > entries[peakIndex].steps) peakIndex = i;
  });

  const totalSteps = entries.reduce((s, e) => s + e.steps, 0);
  const avgSteps   = Math.round(totalSteps / entries.length);

  return { entries, peakIndex, peakEntry: entries[peakIndex], totalSteps, avgSteps };
}

// ─── Skeleton bars shown while loading ───────────────────────────────────────

const SkeletonBars = memo(({ isDark }: { isDark: boolean }) => (
  <View style={[styles.skeleton, { height: CHART_HEIGHT }]}>
    {[0.4, 0.7, 0.55, 1, 0.65, 0.45, 0.3].map((h, i) => (
      <View
        key={i}
        style={[
          styles.skeletonBar,
          { height: CHART_HEIGHT * 0.6 * h, backgroundColor: isDark ? '#2a2a2a' : '#efefef' },
        ]}
      />
    ))}
  </View>
));
SkeletonBars.displayName = 'SkeletonBars';

// ─── Main card ────────────────────────────────────────────────────────────────

const MostActiveDayCard = memo(() => {
  const { colors, isDark } = useTheme();
  const { data: weekData, isLoading } = useWeeklySteps();

  const { entries, peakIndex, peakEntry, totalSteps, avgSteps } = useMemo(
    () => derivePeakData(weekData),
    [weekData],
  );

  const maxVal  = useMemo(() => Math.max(...entries.map(e => e.steps), 1), [entries]);
  const isEmpty = !isLoading && (!entries.length || entries.every(e => e.steps === 0));

  return (
    <Animated.View entering={FadeInDown.delay(100).duration(400)}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: withOpacity(colors.primary, 0.12) }]}>
            <Trophy size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <AppText variant="headline" weight="semiBold" style={{ color: colors.foreground }}>
              Most Active Day
            </AppText>
            <AppText variant="caption2" style={{ color: colors.mutedForeground, marginTop: 1 }}>
              Last 7 days
            </AppText>
          </View>

          {/* Peak day badge */}
          {peakEntry && peakEntry.steps > 0 && (
            <View style={[styles.peakBadge, { backgroundColor: withOpacity(colors.primary, 0.12) }]}>
              <AppText variant="caption1" weight="bold" style={{ color: colors.primary }}>
                {peakEntry.dayLabel}
              </AppText>
            </View>
          )}
        </View>

        {/* ── Stats row ── */}
        {peakEntry && peakEntry.steps > 0 && (
          <PeakStatsRow
            peakSteps={peakEntry.steps}
            totalSteps={totalSteps}
            avgSteps={avgSteps}
            colors={colors}
          />
        )}

        {/* ── Chart / skeleton / empty ── */}
        {isLoading ? (
          <SkeletonBars isDark={isDark} />
        ) : isEmpty ? (
          <View style={[styles.empty, { height: CHART_HEIGHT }]}>
            <AppText variant="subhead" style={{ color: colors.mutedForeground }}>
              No step data this week
            </AppText>
          </View>
        ) : (
          <WeekBarChart
            entries={entries}
            peakIndex={peakIndex}
            maxVal={maxVal}
            primary={colors.primary}
            mutedForeground={colors.mutedForeground}
            cardBg={colors.card}
            isDark={isDark}
          />
        )}

        {/* ── Peak summary line ── */}
        {!isLoading && !isEmpty && peakEntry && peakEntry.steps > 0 && (
          <View style={styles.peakLine}>
            <View style={[styles.peakDot, { backgroundColor: colors.primary }]} />
            <AppText variant="caption2" style={{ color: colors.mutedForeground, marginLeft: 6 }}>
              <AppText variant="caption2" weight="semiBold" style={{ color: colors.primary }}>
                {peakEntry.dayLabel}
              </AppText>
              {' '}was your best day with{' '}
              <AppText variant="caption2" weight="semiBold" style={{ color: colors.foreground }}>
                {peakEntry.steps.toLocaleString()} steps
              </AppText>
            </AppText>
          </View>
        )}
      </View>
    </Animated.View>
  );
});

MostActiveDayCard.displayName = 'MostActiveDayCard';
export default MostActiveDayCard;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 14,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peakBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  skeleton: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  skeletonBar: {
    width: 28,
    borderRadius: 8,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  peakLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 2,
  },
  peakDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
