import React, { memo, useCallback } from 'react';
import { Pressable } from 'react-native';
import { AppView } from '../../../../components';
import { StepProgressCard } from './StepProgressCard';
import MetricCard, { type MetricCardProps } from '../MetricCard';
import { HydrationCard } from './HydrationCard';
import {
  TrackerStreaksBadges,
  TrackerStreaksSkeleton,
} from './TrackerStreaksBadges';
import { TrackerMotivation } from './TrackerMotivation';
import ChallengeTrackerCard from './ChallengeTrackerCard';

import { navigate } from '../../../../navigation/navigationRef';
import { WeeklyStepEntry } from '../../types/healthTypes';
import type { StreaksResponseData } from '../../types/gamification.type';
import { useEarnCoins } from '../../hooks/useEarnCoins';
import { useBmiHistory } from '../../hooks/useBmi';
import { makeStyles } from '../../../../hooks/makeStyles';

export type MetricRow = [MetricCardProps, MetricCardProps];

type Props = {
  hidden?: boolean;
  steps: number;
  goal?: number;
  weekData: WeeklyStepEntry[];
  isWeekPending?: boolean;
  todayIndex?: string; // ISO date "YYYY-MM-DD" for today matching
  metricRows: MetricRow[];
  stats: {
    heartRate: number;
    heartRateMax: number;
    heartRateMin: number;
    bloodPressureDiastolic: number;
    bloodPressureSystolic: number;
    hydration: number;
  };
  streakData?: StreaksResponseData | null;
  isStreakPending: boolean;
  streakDays: number;
  syncDailyProgress: (coinsEarnedThisDay: number, metGoal: boolean) => void;
  onUpdate?: () => void;
};

type RowProps = { row: MetricRow };

const useStyles = makeStyles(({ colors, spacing }) => ({
  container: {
    gap: spacing[3],
  },
  hidden: {
    display: 'none' as const,
  },
  metricRow: {
    flexDirection: 'row' as const,
    gap: spacing[4] ?? 18,
  },
}));

const MetricRowPair = memo(({ row }: RowProps) => {
  const styles = useStyles();
  return (
    <AppView style={styles.metricRow}>
      <MetricCard {...row[0]} />
      <MetricCard {...row[1]} />
    </AppView>
  );
});

MetricRowPair.displayName = 'MetricRowPair';

const DailyStatsSection = memo(
  ({
    hidden,
    steps,
    goal,
    weekData,
    isWeekPending,
    todayIndex,
    metricRows,
    stats,
    streakData,
    isStreakPending,
    streakDays,
    syncDailyProgress,
    onUpdate,
  }: Props) => {
    const styles = useStyles();
    const { earnCoins, isPending: claimPending, claimedToday } = useEarnCoins();
    const { data: bmiHistory } = useBmiHistory(1);
    const latestBmi = bmiHistory?.[0];

    const handleClaim = useCallback(
      (coinsToAdd: number) => {
        earnCoins(coinsToAdd);
        syncDailyProgress(coinsToAdd, steps >= (goal ?? 10000));
      },
      [earnCoins, syncDailyProgress, steps, goal],
    );

    const goToHeartRate = useCallback(() => {
      navigate('HealthStack', { screen: 'HeartRateScreen' });
    }, []);

    const goToBloodPressure = useCallback(() => {
      navigate('HealthStack', { screen: 'BloodPressureScreen' });
    }, []);

    const goToBmiCalculator = useCallback(() => {
      navigate('HealthStack', { screen: 'BmiCalculatorScreen' });
    }, []);

    return (
      <AppView style={[styles.container, hidden && styles.hidden]}>
        <StepProgressCard
          steps={steps}
          goal={goal}
          weekData={weekData}
          isWeekPending={isWeekPending}
          todayIndex={todayIndex}
          claimedToday={claimedToday}
        />

        {metricRows.map((row, i) => (
          <MetricRowPair key={i} row={row} />
        ))}

        <HydrationCard value={stats.hydration} onUpdate={onUpdate} />

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

        <AppView style={{ flexDirection: 'row', gap: 18 }}>
          <MetricCard
            iconName="Activity"
            iconColor="#8B5CF6"
            iconBg="#F5F3FF"
            value={latestBmi?.bmi ?? '—'}
            valueSuffix=""
            label="BMI"
            unit=""
            onPress={goToBmiCalculator}
          />
          <MetricCard
            iconName="Scale"
            iconColor="#3B82F6"
            iconBg="#EFF6FF"
            value={latestBmi?.weight ?? '—'}
            valueSuffix=""
            label="WEIGHT"
            unit="KG"
            onPress={goToBmiCalculator}
          />
        </AppView>

        {isStreakPending && !streakData ? (
          <TrackerStreaksSkeleton />
        ) : (
          <Pressable
            onPress={() => navigate('HealthStack', { screen: 'StreakScreen' })}
          >
            <TrackerStreaksBadges
              streakDays={streakData?.streakDays ?? 0}
              bestStreakDays={streakData?.bestStreakDays ?? 0}
              nextBadgeAt={streakData?.nextBadgeAt}
              badges={streakData?.badges ?? []}
            />
          </Pressable>
        )}

        <ChallengeTrackerCard />

        <TrackerMotivation
          steps={steps}
          goalSteps={goal || 10000}
          streakDays={streakDays}
          onComputed={({ coinsToday, streakWillContinue }) => {
            syncDailyProgress(coinsToday, streakWillContinue);
          }}
        />
      </AppView>
    );
  },
);

DailyStatsSection.displayName = 'DailyStatsSection';

export default DailyStatsSection;
