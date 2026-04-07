import React from 'react';
import { Animated, StyleSheet, } from 'react-native';
import { AppText, AppView } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';

interface StatsCardProps {
  consumed: number;
  dailyGoal: number;
  remaining: number;
  percentage: number;

  children: React.ReactNode; // glass row
}

export const StatsCard: React.FC<StatsCardProps> = ({
  consumed,
  dailyGoal,
  remaining,
  percentage,

  children,
}) => {
  const { colors } = useTheme();

  return (
    <AppView style={[styles.card, { borderColor: colors.border }]}>
      {/* Stats row */}
      <AppView style={styles.statsRow}>
        <StatItem
          value={`${(consumed / 1000).toFixed(1)}L`}
          label="Consumed"
          color={colors.primary}
        />
        <AppView style={[styles.divider, { backgroundColor: withOpacity(colors.primary, 0.2) }]} />
        <StatItem
          value={`${(dailyGoal / 1000).toFixed(1)}L`}
          label="Daily Goal"
          color={withOpacity(colors.primary, 0.7)}
        />
        <AppView style={[styles.divider, { backgroundColor: withOpacity(colors.primary, 0.2) }]} />
        <StatItem
          value={`${(remaining / 1000).toFixed(1)}L`}
          label="Remaining"
          color={withOpacity(colors.primary, 0.4)}
        />
      </AppView>

      {/* Progress bar */}
      <AppView style={[styles.progressOuter, { backgroundColor: withOpacity(colors.primary, 0.1) }]}>
        <Animated.View
          style={[
            styles.progressInner,
            {
              width: `${percentage}%` as any,
              backgroundColor: percentage >= 100 ? colors.success : colors.primary,
            },
          ]}
        />
        <AppText style={[styles.progressPct, { color: withOpacity(colors.primary, 0.6) }]}>{Math.round(percentage)}%</AppText>
      </AppView>

      {/* Children = glass + amount */}
      {children}
    </AppView>
  );
};

const StatItem = ({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) => {
  const { colors } = useTheme();
  return (
    <AppView style={styles.statBox}>
      <AppText style={[styles.statValue, { color }]}>{value}</AppText>
      <AppText style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</AppText>
    </AppView>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statBox: { flex: 1, alignItems: 'center' },
  divider: {
    width: 1,
    height: 40,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  progressOuter: {
    height: 8,
    borderRadius: 4,
    marginBottom: 24,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressInner: {
    height: 8,
    borderRadius: 4,
    minWidth: 4,
  },
  progressPct: {
    position: 'absolute',
    right: 6,
    fontSize: 9,
  },
});
