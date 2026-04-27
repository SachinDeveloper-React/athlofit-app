import React, { memo, useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { BarChart, LineChart } from 'react-native-gifted-charts';

import { AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { METRIC_CONFIG, MetricKey } from './analyticsConstants';
import { HealthAnalyticsResponse } from '../../types/analytics';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_HEIGHT = 200;

type Props = {
  selectedMetric: MetricKey;
  data: HealthAnalyticsResponse;
};

const ChartSection = memo(({ selectedMetric, data }: Props) => {
  const { colors, isDark } = useTheme();
  const cfg = METRIC_CONFIG[selectedMetric];

  const rawData = data.chartDataSets[cfg.chartKey];
  const values  = rawData.length > 0 ? rawData : [0];

  const isBar = selectedMetric === 'steps' || selectedMetric === 'calories';

  // gifted-charts expects { value, label } arrays
  const chartData = useMemo(
    () =>
      values.map((v, i) => ({
        value: v,
        label: data.labels[i] ?? '',
        // bar colour per item
        frontColor: cfg.color,
        // line / area gradient
        dataPointColor: cfg.color,
      })),
    [values, data.labels, cfg.color],
  );

  const maxVal = Math.max(...values, 1);

  // Shared style props
  const commonProps = {
    width: SCREEN_WIDTH - 64,   // card padding (16*2) + a little breathing room
    height: CHART_HEIGHT,
    // Y-axis
    noOfSections: 4,
    maxValue: maxVal,
    yAxisColor: 'transparent',
    yAxisTextStyle: { color: colors.mutedForeground, fontSize: 10 },
    yAxisLabelWidth: 36,
    // X-axis
    xAxisColor: isDark ? '#2B2F3A' : '#E5E7EB',
    xAxisLabelTextStyle: { color: colors.mutedForeground, fontSize: 10 },
    // Grid
    rulesColor: isDark ? '#2B2F3A' : '#E5E7EB',
    rulesType: 'dashed' as const,
    // Background
    backgroundColor: colors.card,
    // Scroll
    scrollToEnd: false,
    initialSpacing: 12,
    endSpacing: 12,
  };

  return (
    <Animated.View
      entering={FadeInUp.duration(350)}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconDot, { backgroundColor: withOpacity(cfg.color, 0.15) }]}>
          <cfg.icon size={14} color={cfg.color} />
        </View>
        <AppText variant="headline" weight="semiBold" style={{ marginLeft: 8 }}>
          {cfg.label} Chart
        </AppText>
      </View>

      {/* Chart */}
      {isBar ? (
        <BarChart
          {...commonProps}
          data={chartData}
          barWidth={28}
          barBorderRadius={6}
          frontColor={cfg.color}
          gradientColor={withOpacity(cfg.color, 0.4)}
          isAnimated
          animationDuration={500}
          showGradient
        />
      ) : (
        <LineChart
          {...commonProps}
          data={chartData}
          color={cfg.color}
          thickness={2.5}
          dataPointsColor={cfg.color}
          dataPointsRadius={5}
          startFillColor={withOpacity(cfg.color, 0.25)}
          endFillColor={withOpacity(cfg.color, 0.02)}
          startOpacity={0.8}
          endOpacity={0.1}
          areaChart
          curved
          isAnimated
          animationDuration={500}
        />
      )}
    </Animated.View>
  );
});

ChartSection.displayName = 'ChartSection';
export default ChartSection;

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconDot: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
