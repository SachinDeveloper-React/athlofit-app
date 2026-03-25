import React, { memo, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { AppView } from '../../../../components';
import { StepProgressCard } from './StepProgressCard';
import MetricCard, { type MetricCardProps } from '../MetricCard';
import { HydrationCard } from './HydrationCard';
import { TrackerStreaksBadges } from './TrackerStreaksBadges';
import { TrackerMotivation } from './TrackerMotivation';
import { navigate } from '../../../../navigation/navigationRef';
import { WeeklyStepEntry } from '../../types/healthTypes';

export type MetricRow = [MetricCardProps, MetricCardProps];

type Props = {
  hidden?: boolean;
  steps: number;
  goal?: number;
  weekData: WeeklyStepEntry[];
  todayIndex?: number;
  metricRows: MetricRow[];
  stats: {
    heartRate: number;
    heartRateMax: number;
    heartRateMin: number;
    bloodPressureDiastolic: number;
    bloodPressureSystolic: number;
    hydration: number;
  };
};

// ─── Sub-components ───────────────────────────────────────────────────────────

type RowProps = { row: MetricRow };

const MetricRowPair = memo(({ row }: RowProps) => (
  <AppView style={styles.metricRow}>
    <MetricCard {...row[0]} />
    <MetricCard {...row[1]} />
  </AppView>
));

MetricRowPair.displayName = 'MetricRowPair';

// ─── Component ────────────────────────────────────────────────────────────────

const DailyStatsSection = memo(
  ({ hidden, steps, goal, weekData, todayIndex, metricRows, stats }: Props) => {
    const goToHeartRate = useCallback(() => {
      navigate('HealthStack', {
        screen: 'HeartRateScreen',
      });
    }, []);

    const goToBloodPressure = useCallback(() => {
      navigate('HealthStack', {
        screen: 'BloodPressureScreen',
      });
    }, []);
    return (
      <AppView style={[styles.container, hidden && styles.hidden]}>
        <StepProgressCard
          steps={steps}
          goal={goal}
          weekData={weekData}
          todayIndex={todayIndex}
        />

        {metricRows.map((row, i) => (
          <MetricRowPair key={i} row={row} />
        ))}

        <HydrationCard value={stats.hydration} max={5000} />

        <AppView style={{ flexDirection: 'row', gap: 18 }}>
          <MetricCard
            iconName="Heart"
            iconColor="#FF0000"
            iconBg="#FFE8E8"
            value={stats.heartRate}
            valueSuffix="AVG"
            label="HEART RATE"
            unit="BPM"
            onPress={goToHeartRate}
          />
          <MetricCard
            iconName="Flame"
            iconColor="#FFA500"
            iconBg="#FFF7E8"
            value={stats.bloodPressureDiastolic}
            valueSuffix={stats.bloodPressureSystolic.toString()}
            label="BLOOD PRESSURE"
            unit="MMHG"
            onPress={goToBloodPressure}
          />
        </AppView>

        <TrackerStreaksBadges
          streakDays={3}
          bestStreakDays={14}
          nextBadgeAt={7}
          badges={[
            { key: 'starter', title: 'Starter', rule: '1 day', unlocked: true },
            {
              key: 'consistent',
              title: 'Consistent',
              rule: '7 days',
              unlocked: false,
            },
            {
              key: 'finisher',
              title: 'Finisher',
              rule: '15 days',
              unlocked: false,
            },
            { key: 'elite', title: 'Elite', rule: '30 days', unlocked: false },
          ]}
        />

        <TrackerMotivation
          steps={5000}
          goalSteps={10000}
          streakDays={10}
          onComputed={({ coinsToday, streakWillContinue }) => {
            // later connect store
          }}
        />
      </AppView>
    );
  },
);

DailyStatsSection.displayName = 'DailyStatsSection';

export default DailyStatsSection;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  hidden: {
    display: 'none',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 18,
  },
});
