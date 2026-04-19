import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
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

const HealthAnalyticsScreen = () => {
  const { colors } = useTheme();
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
          {data.rings && <GoalsSection rings={data.rings} />}

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

          <AppText variant="headline" weight="semiBold" style={styles.sectionLabel}>
            {METRIC_CONFIG[selectedMetric].label} Trend
          </AppText>
          <ChartSection selectedMetric={selectedMetric} data={data} />

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

const styles = StyleSheet.create({
  tabsWrap: { marginBottom: 4 },
  sectionLabel: { marginBottom: 12, marginTop: 20 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 300 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 300, paddingHorizontal: 32 },
  syncBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlaySpinner: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
});
