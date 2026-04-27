import React from 'react';
import { Animated } from 'react-native';
import { AppText, AppView } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { makeStyles } from '../../../../hooks/makeStyles';

interface StatsCardProps {
  consumed: number;
  dailyGoal: number;
  remaining: number;
  percentage: number;
  children: React.ReactNode;
}

const useStyles = makeStyles(({ colors, spacing, radius, fontSize, fontWeight }) => ({
  card: {
    borderRadius: radius['3xl'],
    borderWidth: 1,
    padding: spacing[5],
    marginBottom: spacing[5],
  },
  statsRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: spacing[4],
  },
  statBox: { flex: 1, alignItems: 'center' as const },
  divider: {
    width: 1,
    height: 40,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  statLabel: {
    fontSize: fontSize.xs,
    marginTop: spacing[0.5],
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  progressOuter: {
    height: 8,
    borderRadius: spacing[1],
    marginBottom: spacing[6],
    overflow: 'hidden' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  progressInner: {
    height: 8,
    borderRadius: spacing[1],
    minWidth: 4,
  },
  progressPct: {
    position: 'absolute' as const,
    right: 6,
    fontSize: 9,
  },
}));

export const StatsCard: React.FC<StatsCardProps> = ({
  consumed,
  dailyGoal,
  remaining,
  percentage,
  children,
}) => {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <AppView style={[styles.card, { borderColor: colors.border }]}>
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
  const styles = useStyles();
  return (
    <AppView style={styles.statBox}>
      <AppText style={[styles.statValue, { color }]}>{value}</AppText>
      <AppText style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</AppText>
    </AppView>
  );
};
