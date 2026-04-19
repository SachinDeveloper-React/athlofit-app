import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInLeft } from 'react-native-reanimated';
import { Activity, Flame, Clock, Target } from 'lucide-react-native';

import { AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { RingGoals } from '../../types/analytics';
import RingProgress from './RingProgress';

type Props = { rings: RingGoals };

const GoalsSection = memo(({ rings }: Props) => {
  const { colors } = useTheme();

  return (
    <Animated.View
      entering={FadeInLeft.delay(100).duration(400)}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.titleRow}>
        <Target size={16} color={colors.primary} />
        <AppText variant="headline" weight="semiBold" style={{ marginLeft: 8 }}>
          Daily Goals
        </AppText>
      </View>
      <View style={styles.ringsRow}>
        <RingProgress
          percent={rings.stepsGoalPercent}
          color="#0099FF"
          label="Steps"
          icon={Activity}
          value={`${Math.round(rings.stepsGoalPercent * 100)}%`}
        />
        <RingProgress
          percent={rings.caloriesGoalPercent}
          color="#F97316"
          label="Calories"
          icon={Flame}
          value={`${Math.round(rings.caloriesGoalPercent * 100)}%`}
        />
        <RingProgress
          percent={rings.timeGoalPercent}
          color="#F59E0B"
          label="Active"
          icon={Clock}
          value={`${Math.round(rings.timeGoalPercent * 100)}%`}
        />
      </View>
    </Animated.View>
  );
});

GoalsSection.displayName = 'GoalsSection';
export default GoalsSection;

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginTop: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ringsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
});
