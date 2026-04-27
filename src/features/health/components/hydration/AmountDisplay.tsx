import React from 'react';
import { Animated, View } from 'react-native';
import { AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { makeStyles } from '../../../../hooks/makeStyles';

interface AmountDisplayProps {
  consumed: number;
  dailyGoal: number;
  percentage: number;
}

const useStyles = makeStyles(({ colors, spacing, radius, fontSize, fontWeight }) => ({
  container: {
    alignItems: 'center' as const,
    flex: 1,
  },
  label: {
    fontSize: fontSize.xs,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    marginBottom: spacing[1],
  },
  value: {
    fontSize: 48,
    fontWeight: '900' as const,
    letterSpacing: -2,
  },
  goalText: {
    fontSize: fontSize.sm,
    marginBottom: spacing[4],
  },
  ringOuter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 5,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'transparent',
  },
  ringFill: {
    position: 'absolute' as const,
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 5,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  ringInner: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  ringPct: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
}));

export const AmountDisplay: React.FC<AmountDisplayProps> = ({
  consumed,
  dailyGoal,
  percentage,
}) => {
  const { colors } = useTheme();
  const styles = useStyles();

  const amountColor =
    percentage >= 100 ? colors.success : percentage >= 50 ? colors.primary : withOpacity(colors.primary, 0.7);

  return (
    <View style={styles.container}>
      <AppText style={[styles.label, { color: colors.mutedForeground }]}>ml consumed</AppText>

      <AppText style={[styles.value, { color: amountColor }]}>{consumed}</AppText>

      <AppText style={[styles.goalText, { color: colors.secondaryForeground }]}>/ {dailyGoal} ml</AppText>

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
