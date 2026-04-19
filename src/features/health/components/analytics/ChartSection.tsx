import React, { memo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LineChart, BarChart } from 'react-native-chart-kit';

import { AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { METRIC_CONFIG, MetricKey } from './analyticsConstants';
import { HealthAnalyticsResponse } from '../../types/analytics';

const CHART_WIDTH = Dimensions.get('window').width - 32;

type Props = {
  selectedMetric: MetricKey;
  data: HealthAnalyticsResponse;
};

const ChartSection = memo(({ selectedMetric, data }: Props) => {
  const { colors, isDark } = useTheme();
  const cfg = METRIC_CONFIG[selectedMetric];
  const rawData = data.chartDataSets[cfg.chartKey];
  const chartData = rawData.length > 0 ? rawData : [0];
  const isBar = selectedMetric === 'steps' || selectedMetric === 'calories';

  const chartConfig = {
    backgroundColor: 'transparent',
    backgroundGradientFrom: colors.card,
    backgroundGradientTo: colors.card,
    decimalPlaces: selectedMetric === 'distance' ? 1 : 0,
    color: (opacity = 1) => withOpacity(cfg.color, opacity),
    labelColor: () => colors.mutedForeground,
    style: { borderRadius: 16 },
    propsForDots: {
      r: '5',
      strokeWidth: '2',
      stroke: cfg.color,
      fill: colors.card,
    },
    propsForBackgroundLines: {
      strokeDasharray: '4',
      stroke: isDark ? '#2B2F3A' : '#E5E7EB',
      strokeWidth: '1',
    },
    fillShadowGradient: cfg.color,
    fillShadowGradientOpacity: 0.15,
  };

  return (
    <Animated.View
      entering={FadeInUp.duration(350)}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.header}>
        <View style={[styles.iconDot, { backgroundColor: withOpacity(cfg.color, 0.15) }]}>
          <cfg.icon size={14} color={cfg.color} />
        </View>
        <AppText variant="headline" weight="semiBold" style={{ marginLeft: 8 }}>
          {cfg.label} Chart
        </AppText>
      </View>

      {isBar ? (
        <BarChart
          data={{ labels: data.labels, datasets: [{ data: chartData }] }}
          width={CHART_WIDTH - 32}
          height={200}
          yAxisLabel=""
          yAxisSuffix=""
          chartConfig={chartConfig}
          style={styles.chart}
          showValuesOnTopOfBars={false}
          withInnerLines
          fromZero
        />
      ) : (
        <LineChart
          data={{ labels: data.labels, datasets: [{ data: chartData, strokeWidth: 2.5 }] }}
          width={CHART_WIDTH - 32}
          height={200}
          yAxisLabel=""
          yAxisSuffix=""
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          withShadow
          withDots
          withInnerLines
          fromZero
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
  chart: {
    borderRadius: 12,
    marginLeft: -8,
  },
});
