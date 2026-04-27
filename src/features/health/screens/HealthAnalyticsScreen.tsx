import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Activity, RefreshCw } from 'lucide-react-native';

import { AppText, Header, Screen } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { withOpacity } from '../../../utils/withOpacity';
import { useHealthAnalytics } from '../hooks/useHealthAnalytics';
import { TimeframeTabs } from '../components/TimeframeTabs';
import { Timeframe } from '../types/analytics';
import {
  MetricKey,
  METRIC_CONFIG,
  MetricCard,
  ChartSection,
  GoalsSection,
  SummaryRow,
  InsightCard,
} from '../components/analytics';
import { makeStyles } from '../../../hooks/makeStyles';

const useStyles = makeStyles(({ colors, spacing, radius, shadow }) => ({
  tabsWrap: { marginBottom: spacing[1] },
  sectionLabel: { marginBottom: spacing[3], marginTop: spacing[5] },
  loading: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const, minHeight: 300 },
  empty: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const, minHeight: 300, paddingHorizontal: spacing[8] },
  syncBtn: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center' as const, justifyContent: 'center' as const },
  metricsGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing[2.5] },
  overlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  overlaySpinner: {
    width: spacing[16],
    height: spacing[16],
    borderRadius: radius['2xl'],
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...shadow.md,
  },
}));

const HealthAnalyticsScreen = () => {
  const { colors } = useTheme();
  const styles = useStyles();
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('steps');
  const { activeTab, setActiveTab, data, isLoading, isFetching, syncMutation } = useHealthAnalytics('Week');

  const handleSync = useCallback(() => {
    if (!syncMutation.isPending) syncMutation.mutate();
  }, [syncMutation]);

  const handleTabChange = useCallback(
    (tab: Timeframe) => setActiveTab(tab),
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

  if (isLoading && !data) {
    return (
      <Screen scroll safeArea={false} header={<Header title="Health Analytics" showBack backLabel="" rightAction={
        <TouchableOpacity
          disabled
          style={[styles.syncBtn, { backgroundColor: withOpacity(colors.primary, 0.1) }]}
          activeOpacity={0.7}
        >
          {syncMutation.isPending ? (
            <ActivityIndicator size={16} color={colors.primary} />
          ) : (
            <RefreshCw size={16} color={colors.primary} />
          )}
        </TouchableOpacity>
      } />}>
        <View style={styles.loading}>
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
      scroll
      safeArea={false}
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
      refreshControl={
        <RefreshControl
          refreshing={syncMutation.isPending}
          onRefresh={handleSync}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <View style={styles.tabsWrap}>
        <TimeframeTabs activeTab={activeTab} onTabChange={handleTabChange} />
      </View>

      {data ? (
        <>
          <AppText variant="headline" weight="semiBold" style={styles.sectionLabel}>
            {METRIC_CONFIG[selectedMetric].label} Trend
          </AppText>
          <ChartSection selectedMetric={selectedMetric} data={data} />

          {/* ── Key Metrics ── */}
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

          {/* ── Daily Goals — compact ── */}
          {data.rings && <GoalsSection rings={data.rings} />}

          <SummaryRow data={data} timeframe={activeTab} />
          <InsightCard data={data} />
        </>
      ) : (
        <View style={styles.empty}>
          <Activity size={48} color={colors.mutedForeground} />
          <AppText variant="title3" style={{ color: colors.mutedForeground, marginTop: 16 }}>
            No data available
          </AppText>
          <AppText variant="subhead" style={{ color: colors.mutedForeground, marginTop: 6, textAlign: 'center' }}>
            Sync your health data to see analytics
          </AppText>
        </View>
      )}

      {/* Tab-switch overlay — keeps existing content visible, dims + shows spinner */}
      {isFetching && data && (
        <View style={[styles.overlay, { backgroundColor: withOpacity(colors.background, 0.6) }]}
          pointerEvents="none"
        >
          <View style={[styles.overlaySpinner, { backgroundColor: colors.card }]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </View>
      )}
    </Screen>
  );
};

export default HealthAnalyticsScreen;
