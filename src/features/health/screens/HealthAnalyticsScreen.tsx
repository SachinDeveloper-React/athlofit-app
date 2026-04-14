// src/features/health/screens/HealthAnalyticsScreen.tsx
// ─── Advanced Health Analytics Dashboard ──────────────────────────────────────

import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LineChart, BarChart } from 'react-native-chart-kit';
import Svg, { Circle, G } from 'react-native-svg';
import {
  Activity,
  Heart,
  Droplets,
  Flame,
  MapPin,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  ChevronRight,
  Target,
  Zap,
  Wind,
} from 'lucide-react-native';

import { AppText, Header, Screen } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { withOpacity } from '../../../utils/withOpacity';
import { useHealthAnalytics } from '../hooks/useHealthAnalytics';
import { TimeframeTabs } from '../components/TimeframeTabs';
import { Timeframe, HealthAnalyticsResponse, RingGoals } from '../types/analytics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 32;

// ─── Metric config ────────────────────────────────────────────────────────────

const METRIC_CONFIG = {
  steps: {
    label: 'Steps',
    unit: 'steps',
    icon: Activity,
    color: '#0099FF',
    bg: '#E6F4FF',
    darkBg: '#0D2A40',
    chartKey: 'steps' as const,
  },
  heartRate: {
    label: 'Heart Rate',
    unit: 'bpm',
    icon: Heart,
    color: '#EF4444',
    bg: '#FEF2F2',
    darkBg: '#3A1515',
    chartKey: 'heart' as const,
  },
  bloodPressure: {
    label: 'Blood Pressure',
    unit: 'mmHg',
    icon: Droplets,
    color: '#8B5CF6',
    bg: '#F5F3FF',
    darkBg: '#2A1A40',
    chartKey: 'bp' as const,
  },
  calories: {
    label: 'Calories',
    unit: 'kcal',
    icon: Flame,
    color: '#F97316',
    bg: '#FFF7ED',
    darkBg: '#3A1F0A',
    chartKey: 'calories' as const,
  },
  distance: {
    label: 'Distance',
    unit: 'km',
    icon: MapPin,
    color: '#10B981',
    bg: '#ECFDF5',
    darkBg: '#0A2A1E',
    chartKey: 'distance' as const,
  },
  activityTime: {
    label: 'Active Time',
    unit: 'min',
    icon: Clock,
    color: '#F59E0B',
    bg: '#FFFBEB',
    darkBg: '#2A2008',
    chartKey: 'time' as const,
  },
} as const;

type MetricKey = keyof typeof METRIC_CONFIG;

// ─── Ring Progress ────────────────────────────────────────────────────────────

const RING_SIZE = 80;
const RING_STROKE = 8;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_R;

const RingProgress = memo(
  ({
    percent,
    color,
    label,
    icon: Icon,
    value,
    unit,
  }: {
    percent: number;
    color: string;
    label: string;
    icon: any;
    value: string;
    unit: string;
  }) => {
    const { colors, isDark } = useTheme();
    const dash = RING_CIRC * Math.min(1, Math.max(0, percent));
    const gap = RING_CIRC - dash;

    return (
      <View style={styles.ringWrap}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <G rotation="-90" origin={`${RING_SIZE / 2},${RING_SIZE / 2}`}>
            {/* Track */}
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_R}
              stroke={isDark ? '#2B2F3A' : '#E5E7EB'}
              strokeWidth={RING_STROKE}
              fill="none"
            />
            {/* Progress */}
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_R}
              stroke={color}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeDasharray={`${dash} ${gap}`}
              strokeLinecap="round"
            />
          </G>
        </Svg>
        {/* Center icon */}
        <View style={[styles.ringCenter, { backgroundColor: withOpacity(color, 0.12) }]}>
          <Icon size={18} color={color} />
        </View>
        <AppText variant="caption2" weight="semiBold" style={{ marginTop: 6, color }}>
          {value}
        </AppText>
        <AppText variant="caption2" style={{ color: colors.mutedForeground, marginTop: 1 }}>
          {label}
        </AppText>
        <AppText variant="caption2" style={{ color: colors.mutedForeground, opacity: 0.6 }}>
          {Math.round(percent * 100)}% goal
        </AppText>
      </View>
    );
  },
);
RingProgress.displayName = 'RingProgress';

// ─── Trend Badge ──────────────────────────────────────────────────────────────

const TrendBadge = memo(({ trend }: { trend: number }) => {
  const isUp = trend > 0;
  const isFlat = trend === 0;
  const color = isFlat ? '#6B7280' : isUp ? '#10B981' : '#EF4444';
  const bg = isFlat ? '#F3F4F6' : isUp ? '#ECFDF5' : '#FEF2F2';
  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;

  return (
    <View style={[styles.trendBadge, { backgroundColor: bg }]}>
      <Icon size={10} color={color} />
      <AppText variant="caption2" weight="semiBold" style={{ color, marginLeft: 2 }}>
        {isFlat ? '—' : `${Math.abs(trend)}%`}
      </AppText>
    </View>
  );
});
TrendBadge.displayName = 'TrendBadge';

// ─── Metric Card ──────────────────────────────────────────────────────────────

const MetricCard = memo(
  ({
    metricKey,
    value,
    trend,
    isSelected,
    onPress,
    index,
  }: {
    metricKey: MetricKey;
    value: string | number;
    trend: number;
    isSelected: boolean;
    onPress: () => void;
    index: number;
  }) => {
    const { colors, isDark } = useTheme();
    const cfg = METRIC_CONFIG[metricKey];
    const Icon = cfg.icon;
    const scale = useSharedValue(1);

    const animStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePress = () => {
      scale.value = withSpring(0.95, { damping: 15 }, () => {
        scale.value = withSpring(1);
      });
      onPress();
    };

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 60).duration(400)}
        style={[animStyle, styles.metricCardWrap]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handlePress}
          style={[
            styles.metricCard,
            {
              backgroundColor: isSelected
                ? isDark
                  ? cfg.darkBg
                  : cfg.bg
                : colors.card,
              borderColor: isSelected ? cfg.color : colors.border,
              borderWidth: isSelected ? 1.5 : StyleSheet.hairlineWidth,
            },
          ]}
        >
          <View style={[styles.metricIconWrap, { backgroundColor: withOpacity(cfg.color, 0.15) }]}>
            <Icon size={18} color={cfg.color} />
          </View>
          <AppText variant="caption1" style={{ color: colors.mutedForeground, marginTop: 8 }}>
            {cfg.label}
          </AppText>
          <View style={styles.metricValueRow}>
            <AppText variant="title3" weight="bold" style={{ color: colors.foreground }}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </AppText>
            <AppText variant="caption2" style={{ color: colors.mutedForeground, marginLeft: 3 }}>
              {cfg.unit}
            </AppText>
          </View>
          <TrendBadge trend={trend} />
        </TouchableOpacity>
      </Animated.View>
    );
  },
);
MetricCard.displayName = 'MetricCard';

// ─── Chart Section ────────────────────────────────────────────────────────────

const ChartSection = memo(
  ({
    selectedMetric,
    data,
  }: {
    selectedMetric: MetricKey;
    data: HealthAnalyticsResponse;
  }) => {
    const { colors, isDark } = useTheme();
    const cfg = METRIC_CONFIG[selectedMetric];
    const rawData = data.chartDataSets[cfg.chartKey];
    const chartData = rawData.length > 0 ? rawData : [0];
    const labels = data.labels;

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
        style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.chartHeader}>
          <View style={[styles.chartIconDot, { backgroundColor: withOpacity(cfg.color, 0.15) }]}>
            <cfg.icon size={14} color={cfg.color} />
          </View>
          <AppText variant="headline" weight="semiBold" style={{ marginLeft: 8 }}>
            {cfg.label} Chart
          </AppText>
        </View>

        {isBar ? (
          <BarChart
            data={{ labels, datasets: [{ data: chartData }] }}
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
            data={{ labels, datasets: [{ data: chartData, strokeWidth: 2.5 }] }}
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
  },
);
ChartSection.displayName = 'ChartSection';

// ─── Goals Ring Section ───────────────────────────────────────────────────────

const GoalsSection = memo(({ rings }: { rings: RingGoals }) => {
  const { colors } = useTheme();

  return (
    <Animated.View
      entering={FadeInLeft.delay(100).duration(400)}
      style={[styles.goalsCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.goalsTitleRow}>
        <Target size={16} color={colors.primary} />
        <AppText variant="headline" weight="semiBold" style={{ marginLeft: 8 }}>
          Daily Goals
        </AppText>
      </View>
      <View style={styles.ringsRow}>
        <RingProgress
          percent={rings.stepsGoalPercent}
          color="#0099FF"
          label="Steps"
          icon={Activity}
          value={`${Math.round(rings.stepsGoalPercent * 100)}%`}
          unit="of goal"
        />
        <RingProgress
          percent={rings.caloriesGoalPercent}
          color="#F97316"
          label="Calories"
          icon={Flame}
          value={`${Math.round(rings.caloriesGoalPercent * 100)}%`}
          unit="of goal"
        />
        <RingProgress
          percent={rings.timeGoalPercent}
          color="#F59E0B"
          label="Active"
          icon={Clock}
          value={`${Math.round(rings.timeGoalPercent * 100)}%`}
          unit="of goal"
        />
      </View>
    </Animated.View>
  );
});
GoalsSection.displayName = 'GoalsSection';

// ─── Summary Stats Row ────────────────────────────────────────────────────────

const SummaryRow = memo(
  ({
    data,
    timeframe,
  }: {
    data: HealthAnalyticsResponse;
    timeframe: Timeframe;
  }) => {
    const { colors } = useTheme();
    const { metrics } = data;

    const items = [
      {
        label: 'Avg Heart Rate',
        value: metrics.heartRate.value > 0 ? `${metrics.heartRate.value} bpm` : '—',
        icon: Heart,
        color: '#EF4444',
      },
      {
        label: 'Blood Pressure',
        value: metrics.bloodPressure.value !== '—' ? metrics.bloodPressure.value : '—',
        icon: Droplets,
        color: '#8B5CF6',
      },
      {
        label: 'Total Distance',
        value: `${metrics.distance.value} km`,
        icon: MapPin,
        color: '#10B981',
      },
    ];

    return (
      <Animated.View
        entering={FadeInRight.delay(150).duration(400)}
        style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.summaryTitleRow}>
          <Zap size={16} color={colors.primary} />
          <AppText variant="headline" weight="semiBold" style={{ marginLeft: 8 }}>
            {timeframe} Summary
          </AppText>
        </View>
        {items.map((item, i) => (
          <View
            key={item.label}
            style={[
              styles.summaryItem,
              i < items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
            ]}
          >
            <View style={[styles.summaryIconWrap, { backgroundColor: withOpacity(item.color, 0.12) }]}>
              <item.icon size={14} color={item.color} />
            </View>
            <AppText variant="subhead" style={{ flex: 1, marginLeft: 10, color: colors.mutedForeground }}>
              {item.label}
            </AppText>
            <AppText variant="subhead" weight="semiBold" style={{ color: colors.foreground }}>
              {item.value}
            </AppText>
          </View>
        ))}
      </Animated.View>
    );
  },
);
SummaryRow.displayName = 'SummaryRow';

// ─── Insight Card ─────────────────────────────────────────────────────────────

const InsightCard = memo(({ data }: { data: HealthAnalyticsResponse }) => {
  const { colors } = useTheme();
  const { metrics, rings } = data;

  const insights = useMemo(() => {
    const list: { text: string; color: string; icon: any }[] = [];

    if (metrics.steps.trend > 10)
      list.push({ text: `Steps up ${metrics.steps.trend}% vs last period — great momentum!`, color: '#10B981', icon: TrendingUp });
    else if (metrics.steps.trend < -10)
      list.push({ text: `Steps down ${Math.abs(metrics.steps.trend)}% — try to move more today.`, color: '#EF4444', icon: TrendingDown });

    if (rings.stepsGoalPercent >= 1)
      list.push({ text: 'Step goal achieved! You\'re crushing it.', color: '#0099FF', icon: Target });

    if (metrics.heartRate.value > 0 && metrics.heartRate.value > 100)
      list.push({ text: 'Elevated avg heart rate — consider rest or light activity.', color: '#F97316', icon: Wind });
    else if (metrics.heartRate.value > 0 && metrics.heartRate.value < 60)
      list.push({ text: 'Low resting heart rate — excellent cardiovascular fitness!', color: '#10B981', icon: Heart });

    if (rings.caloriesGoalPercent >= 0.9)
      list.push({ text: 'Calorie burn on track — keep it up!', color: '#F97316', icon: Flame });

    if (list.length === 0)
      list.push({ text: 'Sync your health data to see personalized insights.', color: colors.mutedForeground, icon: Activity });

    return list.slice(0, 3);
  }, [metrics, rings, colors]);

  return (
    <Animated.View
      entering={FadeInDown.delay(200).duration(400)}
      style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.insightTitleRow}>
        <Zap size={16} color="#F59E0B" />
        <AppText variant="headline" weight="semiBold" style={{ marginLeft: 8 }}>
          Insights
        </AppText>
      </View>
      {insights.map((ins, i) => (
        <View key={i} style={styles.insightRow}>
          <View style={[styles.insightDot, { backgroundColor: withOpacity(ins.color, 0.15) }]}>
            <ins.icon size={12} color={ins.color} />
          </View>
          <AppText variant="subhead" style={{ flex: 1, marginLeft: 10, color: colors.foreground, lineHeight: 20 }}>
            {ins.text}
          </AppText>
        </View>
      ))}
    </Animated.View>
  );
});
InsightCard.displayName = 'InsightCard';

// ─── Main Screen ──────────────────────────────────────────────────────────────

const HealthAnalyticsScreen = () => {
  const { colors } = useTheme();
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('steps');
  const { activeTab, setActiveTab, data, isLoading, syncMutation } = useHealthAnalytics('Week');

  const handleSync = useCallback(() => {
    if (!syncMutation.isPending) syncMutation.mutate();
  }, [syncMutation]);

  const handleTabChange = useCallback(
    (tab: Timeframe) => {
      setActiveTab(tab);
    },
    [setActiveTab],
  );

  const metricEntries = useMemo(
    () =>
      (Object.keys(METRIC_CONFIG) as MetricKey[]).map((key, i) => ({
        key,
        index: i,
        value: data?.metrics?.[key]?.value ?? 0,
        trend: (data?.metrics?.[key] as any)?.trend ?? 0,
      })),
    [data],
  );

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading && !data) {
    return (
      <Screen safeArea={false} header={<Header title="Health Analytics" showBack backLabel="" />}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText variant="subhead" style={{ color: colors.mutedForeground, marginTop: 14 }}>
            Loading analytics…
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      safeArea={false}
      padded={false}
      header={
        <Header
          title="Health Analytics"
          showBack
          backLabel=""
          rightAction={
            <TouchableOpacity
              onPress={handleSync}
              style={[styles.syncBtn, { backgroundColor: withOpacity(colors.primary, 0.1) }]}
              activeOpacity={0.7}
            >
              {syncMutation.isPending ? (
                <ActivityIndicator size={16} color={colors.primary} />
              ) : (
                <RefreshCw size={16} color={colors.primary} />
              )}
            </TouchableOpacity>
          }
        />
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={syncMutation.isPending}
            onRefresh={handleSync}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Timeframe Tabs */}
        <View style={styles.tabsWrap}>
          <TimeframeTabs activeTab={activeTab} onTabChange={handleTabChange} />
        </View>

        {data ? (
          <>
            {/* ── Goals Rings ── */}
            {data.rings && <GoalsSection rings={data.rings} />}

            {/* ── Metric Cards Grid ── */}
            <Animated.View entering={FadeInDown.duration(300)}>
              <AppText variant="headline" weight="semiBold" style={styles.sectionLabel}>
                Key Metrics
              </AppText>
              <View style={styles.metricsGrid}>
                {metricEntries.map(({ key, index, value, trend }) => (
                  <MetricCard
                    key={key}
                    metricKey={key}
                    value={value}
                    trend={trend}
                    isSelected={selectedMetric === key}
                    onPress={() => setSelectedMetric(key)}
                    index={index}
                  />
                ))}
              </View>
            </Animated.View>

            {/* ── Chart ── */}
            <AppText variant="headline" weight="semiBold" style={styles.sectionLabel}>
              {METRIC_CONFIG[selectedMetric].label} Trend
            </AppText>
            <ChartSection selectedMetric={selectedMetric} data={data} />

            {/* ── Summary ── */}
            <SummaryRow data={data} timeframe={activeTab} />

            {/* ── Insights ── */}
            <InsightCard data={data} />
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Activity size={48} color={colors.mutedForeground} />
            <AppText variant="title3" style={{ color: colors.mutedForeground, marginTop: 16 }}>
              No data available
            </AppText>
            <AppText variant="subhead" style={{ color: colors.mutedForeground, marginTop: 6, textAlign: 'center' }}>
              Sync your health data to see analytics
            </AppText>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </Screen>
  );
};

export default HealthAnalyticsScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  tabsWrap: {
    marginBottom: 4,
  },
  sectionLabel: {
    marginBottom: 12,
    marginTop: 20,
  },

  // Loading / Empty
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
    paddingHorizontal: 32,
  },

  // Sync button
  syncBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Metric cards
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCardWrap: {
    width: '48%',
  },
  metricCard: {
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginTop: 2,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 4,
  },

  // Chart
  chartCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    overflow: 'hidden',
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  chartIconDot: {
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

  // Goals rings
  goalsCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginTop: 4,
  },
  goalsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ringsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  ringWrap: {
    alignItems: 'center',
    gap: 2,
  },
  ringCenter: {
    position: 'absolute',
    top: (RING_SIZE - 32) / 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Summary
  summaryCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginTop: 20,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  summaryIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Insights
  insightCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginTop: 16,
  },
  insightTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  insightDot: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
});
