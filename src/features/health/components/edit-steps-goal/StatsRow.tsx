import React from 'react';
import { StyleSheet } from 'react-native';
import { AppText, AppView, Card } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { StepsStats } from '../../hooks/useStepsGoal';

interface StatsRowProps {
  stats: StepsStats;
}

interface StatCardProps {
  label: string;
  value: string;
}

function StatCard({ label, value }: StatCardProps) {
  const { colors } = useTheme();
  return (
    <Card variant="filled" style={styles.card}>
      <AppText variant="caption1" secondary style={styles.label}>{label}</AppText>
      <AppText variant="subhead" weight="medium" style={{ color: colors.foreground }}>
        {value}
      </AppText>
    </Card>
  );
}

export function StatsRow({ stats }: StatsRowProps) {
  return (
    <AppView row gap={2} style={styles.row}>
      <StatCard label="Est. distance" value={`${stats.distance} km`} />
      <StatCard label="Est. calories" value={`${stats.calories} kcal`} />
      <StatCard label="Est. time" value={`~${stats.time} min`} />
    </AppView>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 28,
  },
  card: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  label: {
    marginBottom: 4,
  },
});
