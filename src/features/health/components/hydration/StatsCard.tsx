import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

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
  return (
    <View style={[styles.card]}>
      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatItem
          value={`${(consumed / 1000).toFixed(1)}L`}
          label="Consumed"
          color="#38bdf8"
        />
        <View style={styles.divider} />
        <StatItem
          value={`${(dailyGoal / 1000).toFixed(1)}L`}
          label="Daily Goal"
          color="#7dd3fc"
        />
        <View style={styles.divider} />
        <StatItem
          value={`${(remaining / 1000).toFixed(1)}L`}
          label="Remaining"
          color="#bae6fd"
        />
      </View>

      {/* Progress bar */}
      <View style={styles.progressOuter}>
        <Animated.View
          style={[
            styles.progressInner,
            {
              width: `${percentage}%` as any,
              backgroundColor: percentage >= 100 ? '#4ade80' : '#38bdf8',
            },
          ]}
        />
        <Text style={styles.progressPct}>{Math.round(percentage)}%</Text>
      </View>

      {/* Children = glass + amount */}
      {children}
    </View>
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
}) => (
  <View style={styles.statBox}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(14,50,80,0.4)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.15)',
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
    backgroundColor: 'rgba(56,189,248,0.2)',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  progressOuter: {
    height: 8,
    backgroundColor: 'rgba(56,189,248,0.1)',
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
    color: 'rgba(56,189,248,0.6)',
  },
});
