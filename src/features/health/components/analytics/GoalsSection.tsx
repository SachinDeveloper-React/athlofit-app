import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInLeft } from 'react-native-reanimated';
import { Activity, Flame, Clock } from 'lucide-react-native';

import { AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { RingGoals } from '../../types/analytics';

type Props = { rings: RingGoals };

type GoalPillProps = {
  icon: any;
  label: string;
  percent: number;
  color: string;
};

const GoalPill = memo(({ icon: Icon, label, percent, color }: GoalPillProps) => {
  const { colors } = useTheme();
  const pct = Math.round(percent * 100);
  const met = pct >= 100;

  return (
    <View style={[styles.pill, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.pillIcon, { backgroundColor: withOpacity(color, 0.12) }]}>
        <Icon size={13} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="caption2" style={{ color: colors.mutedForeground }}>{label}</AppText>
        {/* Progress bar */}
        <View style={[styles.bar, { backgroundColor: withOpacity(color, 0.15) }]}>
          <View
            style={[
              styles.barFill,
              { width: `${Math.min(100, pct)}%` as any, backgroundColor: color },
            ]}
          />
        </View>
      </View>
      <AppText
        variant="caption2"
        weight="semiBold"
        style={{ color: met ? color : colors.mutedForeground, marginLeft: 6 }}
      >
        {met ? '✓' : `${pct}%`}
      </AppText>
    </View>
  );
});

GoalPill.displayName = 'GoalPill';

const GoalsSection = memo(({ rings }: Props) => {
  return (
    <Animated.View
      entering={FadeInLeft.delay(100).duration(400)}
      style={styles.container}
    >
      <GoalPill icon={Activity} label="Steps"    percent={rings.stepsGoalPercent}    color="#0099FF" />
      <GoalPill icon={Flame}    label="Calories"  percent={rings.caloriesGoalPercent} color="#F97316" />
      <GoalPill icon={Clock}    label="Active"    percent={rings.timeGoalPercent}     color="#F59E0B" />
    </Animated.View>
  );
});

GoalsSection.displayName = 'GoalsSection';
export default GoalsSection;

const styles = StyleSheet.create({
  container: {
    gap: 8,
    marginTop: 20,
    marginBottom: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    height: 4,
    borderRadius: 2,
    marginTop: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
});
