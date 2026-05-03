// src/features/health/components/analytics/most-active-day/WeekBarChart.tsx
import React, { memo, useCallback } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { AppText } from '../../../../../components';
import { withOpacity } from '../../../../../utils/withOpacity';
import { formatSteps } from '../../../utils/analyticsFormatters';
import { navigate } from '../../../../../navigation/navigationRef';
import { HealthRoutes, RootRoutes } from '../../../../../navigation/routes';
import type { WeekEntry } from '../../../types/mostActiveDay.types';

const SCREEN_WIDTH  = Dimensions.get('window').width;
const CHART_PADDING = 32;
export const CHART_HEIGHT = 160;

interface Props {
  entries: WeekEntry[];
  peakIndex: number;
  maxVal: number;
  primary: string;
  mutedForeground: string;
  cardBg: string;
  isDark: boolean;
}

const WeekBarChart = memo(({
  entries,
  peakIndex,
  maxVal,
  primary,
  mutedForeground,
  cardBg,
  isDark,
}: Props) => {
  const handleBarPress = useCallback((item: any, index: number) => {
    const entry = entries[index];
    if (!entry?.date) return;
    // Use fullDate if available (YYYY-MM-DD), otherwise the date field itself
    const isoDate = entry.date.length === 10 ? entry.date : null;
    if (!isoDate) return;
    navigate(RootRoutes.HEALTH_NAVIGATOR, {
      screen: HealthRoutes.STEP_DETAIL,
      params: { date: isoDate },
    });
  }, [entries]);

  const chartData = entries.map((e, i) => {
    const isPeak = i === peakIndex && e.steps > 0;
    return {
      value: e.steps,
      label: e.dayLabel,
      frontColor:    isPeak ? primary : withOpacity(primary, 0.22),
      gradientColor: isPeak ? withOpacity(primary, 0.55) : withOpacity(primary, 0.08),
      topLabelComponent: isPeak
        ? () => (
            <AppText style={{ fontSize: 9, color: primary, fontWeight: '700', marginBottom: 2, textAlign: 'center' }}>
              {formatSteps(e.steps)}
            </AppText>
          )
        : undefined,
    };
  });

  return (
    <View style={styles.wrap}>
      <BarChart
        data={chartData}
        width={SCREEN_WIDTH - CHART_PADDING - 48}
        height={CHART_HEIGHT}
        barWidth={28}
        barBorderRadius={8}
        barBorderTopLeftRadius={8}
        barBorderTopRightRadius={8}
        noOfSections={4}
        maxValue={maxVal}
        yAxisColor="transparent"
        yAxisTextStyle={{ color: mutedForeground, fontSize: 9 }}
        yAxisLabelWidth={40}
        formatYLabel={(v: string) => formatSteps(Number(v))}
        xAxisColor={isDark ? '#2B2F3A' : '#E5E7EB'}
        xAxisLabelTextStyle={{ color: mutedForeground, fontSize: 11, fontWeight: '500' }}
        rulesColor={isDark ? '#2B2F3A' : '#EFEFEF'}
        rulesType="dashed"
        backgroundColor={cardBg}
        isAnimated
        animationDuration={600}
        showGradient
        initialSpacing={8}
        endSpacing={8}
        spacing={16}
        activeOpacity={0.8}
        onPress={handleBarPress}
      />
    </View>
  );
});

WeekBarChart.displayName = 'WeekBarChart';
export default WeekBarChart;

const styles = StyleSheet.create({
  wrap: { marginLeft: -4 },
});
