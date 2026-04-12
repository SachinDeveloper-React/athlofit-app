import React from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { AppText, Screen, Header, IconButton } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { useHealthAnalytics } from '../hooks/useHealthAnalytics';
import { TimeframeTabs } from '../components/TimeframeTabs';
import { HealthMetricCard } from '../components/HealthMetricCard';
import { SCREEN_WIDTH } from '../../../utils/measure';

const HealthAnalyticsScreen = () => {
  const { colors, isDark } = useTheme();
  const { activeTab, setActiveTab, data, isLoading, syncMutation } =
    useHealthAnalytics('Day');

  const handleSync = () => {
    if (!syncMutation.isPending) {
      syncMutation.mutate();
    }
  };

  const renderContent = () => {
    if (isLoading || !data) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText variant="subhead" secondary style={{ marginTop: 12 }}>
            Loading analytics...
          </AppText>
        </View>
      );
    }

    const { metrics, chartDataSets, labels } = data;

    return (
      <View style={styles.content}>
        <AppText variant="title2" style={styles.sectionTitle}>
          Key Metrics
        </AppText>

        {/* Metrics Grid */}
        <View style={styles.gridContainer}>
          <HealthMetricCard
            type="steps"
            title="Steps"
            value={metrics.steps?.value.toLocaleString()}
            unit="steps"
          />
          <HealthMetricCard
            type="heart"
            title="Heart Rate"
            value={metrics.heartRate?.value}
            unit="bpm"
          />
          <HealthMetricCard
            type="bp"
            title="Blood Pressure"
            value={metrics.bloodPressure?.value}
            unit="mmHg"
          />
          <HealthMetricCard
            type="calories"
            title="Calories"
            value={metrics.calories?.value.toLocaleString()}
            unit="kcal"
          />
          <HealthMetricCard
            type="distance"
            title="Distance"
            value={metrics.distance?.value}
            unit="km"
          />
          <HealthMetricCard
            type="time"
            title="Activity Time"
            value={metrics.activityTime?.value}
            unit="mins"
          />
        </View>

        <AppText variant="title2" style={styles.sectionTitle}>
          Overview
        </AppText>

        {/* Chart Section */}
        <View style={styles.chartContainer}>
          <LineChart
            data={{
              labels: labels,
              datasets: [
                {
                  data:
                    chartDataSets.steps.length > 0 ? chartDataSets.steps : [0],
                },
              ],
            }}
            width={SCREEN_WIDTH - 32}
            height={220}
            yAxisSuffix=""
            yAxisLabel=""
            chartConfig={{
              backgroundColor: 'transparent',
              backgroundGradientFrom: colors.card,
              backgroundGradientTo: colors.card,
              decimalPlaces: 0,
              color: (opacity = 1) =>
                `rgba(${isDark ? '255, 255, 255' : '0, 0, 0'}, ${opacity})`,
              labelColor: (opacity = 1) => colors.mutedForeground,
              style: { borderRadius: 16 },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: colors.primary,
              },
              propsForBackgroundLines: {
                strokeDasharray: '4',
                stroke: colors.border,
              },
            }}
            bezier
            style={styles.chart}
          />
        </View>
      </View>
    );
  };

  return (
    <Screen
      scroll
      header={
        <Header
          title="Health Analytics"
          showBack
          backLabel=""
          rightAction={
            <IconButton
              name="RefreshCw"
              onPress={handleSync}
              borderColor={colors.border}
              borderRadius={12}
            />
          }
        />
      }
      safeArea={false}
      refreshControl={
        <RefreshControl
          refreshing={syncMutation.isPending}
          onRefresh={handleSync}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <View style={styles.container}>
        <TimeframeTabs activeTab={activeTab} onTabChange={setActiveTab} />
        {renderContent()}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    minHeight: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: 16,
    marginTop: 8,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  chart: {
    borderRadius: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});

export default HealthAnalyticsScreen;
