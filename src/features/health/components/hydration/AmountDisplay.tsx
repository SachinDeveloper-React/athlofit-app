import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';

interface AmountDisplayProps {
  consumed: number;
  dailyGoal: number;
  percentage: number;
}

export const AmountDisplay: React.FC<AmountDisplayProps> = ({
  consumed,
  dailyGoal,
  percentage,
}) => {
  const { colors } = useTheme();
  
  const amountColor =
    percentage >= 100 ? colors.success : percentage >= 50 ? colors.primary : withOpacity(colors.primary, 0.7);

  return (
    <View style={styles.container}>
      <AppText style={[styles.label, { color: colors.mutedForeground }]}>ml consumed</AppText>

      <AppText style={[styles.value, { color: amountColor }]}>{consumed}</AppText>

      <AppText style={[styles.goalText, { color: colors.secondaryForeground }]}>/ {dailyGoal} ml</AppText>

      {/* Circular ring indicator */}
      <View style={[styles.ringOuter, { borderColor: withOpacity(colors.primary, 0.15) }]}>
        <View
          style={[
            styles.ringFill,
            { borderColor: colors.primary, transform: [{ rotate: `${(percentage / 100) * 360}deg` }] },
          ]}
        />
        <View style={styles.ringInner}>
          <AppText style={[styles.ringPct, { color: colors.primary }]}>{Math.round(percentage)}%</AppText>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
  },
  label: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  value: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -2,
  },
  goalText: {
    fontSize: 13,
    marginBottom: 16,
  },
  ringOuter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  ringFill: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 5,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  ringInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPct: {
    fontSize: 14,
    fontWeight: '700',
  },
});
