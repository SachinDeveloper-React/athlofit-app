// ─── CalorieSummaryCard.tsx ────────────────────────────────────────────────────
import React, { memo, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { AppText, AppView, Card } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { makeStyles } from '../../../../hooks/makeStyles';

interface Props {
  caloriesIn: number;
  caloriesOut: number;
  calorieGoal: number;
  protein: number;
  carbs: number;
  fat: number;
}

const RING_SIZE = 100;
const STROKE = 10;
const R = (RING_SIZE - STROKE) / 2;
const CIRCUM = 2 * Math.PI * R;
const CX = RING_SIZE / 2;
const CY = RING_SIZE / 2;

interface RingProps {
  percent: number;
  color: string;
  trackColor: string;
}

const CalorieRing = memo(({ percent, color, trackColor }: RingProps) => {
  const clamp = Math.min(100, Math.max(0, percent));
  const dash = (clamp / 100) * CIRCUM;
  const gap = CIRCUM - dash;

  return (
    <Svg width={RING_SIZE} height={RING_SIZE}>
      <Circle cx={CX} cy={CY} r={R} stroke={trackColor} strokeWidth={STROKE} fill="none" />
      <Circle
        cx={CX} cy={CY} r={R} stroke={color} strokeWidth={STROKE} fill="none"
        strokeDasharray={`${dash} ${gap}`} strokeLinecap="round"
        transform={`rotate(-90 ${CX} ${CY})`}
      />
    </Svg>
  );
});

CalorieRing.displayName = 'CalorieRing';

interface MacroPillProps {
  label: string;
  value: number;
  unit: string;
  color: string;
}

const MacroPill = memo(({ label, value, unit, color }: MacroPillProps) => {
  const styles = useStyles();
  return (
    <AppView style={styles.macroPill}>
      <View style={[styles.macroDot, { backgroundColor: color }]} />
      <AppText variant="caption2" weight="semiBold" color={color}>
        {value}{unit}
      </AppText>
      <AppText variant="caption2">{label}</AppText>
    </AppView>
  );
});

MacroPill.displayName = 'MacroPill';

const useStyles = makeStyles(({ colors, spacing, radius }) => ({
  card: { gap: spacing[4] },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  body: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[5],
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  ringCenter: {
    position: 'absolute' as const,
    alignItems: 'center' as const,
  },
  statsCol: { flex: 1, gap: spacing[2.5] },
  statRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing[2.5] },
  statDot: { width: 8, height: 8, borderRadius: radius.full },
  burnRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
  },
  burnBarBg: {
    flex: 1,
    height: 6,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden' as const,
  },
  burnBarFill: {
    height: 6,
    borderRadius: radius.sm,
  },
  macroRow: {
    flexDirection: 'row' as const,
    gap: spacing[2],
  },
  macroPill: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[1],
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: radius['2xl'],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1.5],
  },
  macroDot: { width: 6, height: 6, borderRadius: radius.sm },
}));

export const CalorieSummaryCard = memo(
  ({ caloriesIn, caloriesOut, calorieGoal, protein, carbs, fat }: Props) => {
    const { colors } = useTheme();
    const styles = useStyles();

    const inPercent = useMemo(
      () => (calorieGoal > 0 ? (caloriesIn / calorieGoal) * 100 : 0),
      [caloriesIn, calorieGoal],
    );

    const outPercent = useMemo(
      () => (calorieGoal > 0 ? (caloriesOut / calorieGoal) * 100 : 0),
      [caloriesOut, calorieGoal],
    );

    const net = calorieGoal - caloriesIn;
    const isOver = net < 0;
    const netLabel = isOver
      ? `${Math.abs(net)} kcal over goal`
      : `${net} kcal remaining`;
    const netColor = isOver ? '#C0392B' : '#2E7D62';

    return (
      <Card style={styles.card}>
        <AppView style={styles.header}>
          <AppText variant="headline">Calories Today</AppText>
          <AppText variant="caption1" color={netColor} weight="semiBold">
            {netLabel}
          </AppText>
        </AppView>

        <AppView style={styles.body}>
          <AppView style={styles.ringWrap}>
            <CalorieRing
              percent={inPercent}
              color={colors.primary}
              trackColor={withOpacity(colors.primary, 0.12)}
            />
            <AppView style={styles.ringCenter}>
              <AppText variant="title3" weight="bold">
                {caloriesIn}
              </AppText>
              <AppText variant="caption2">kcal in</AppText>
            </AppView>
          </AppView>

          <AppView style={styles.statsCol}>
            <AppView style={styles.statRow}>
              <View style={[styles.statDot, { backgroundColor: colors.primary }]} />
              <AppView>
                <AppText variant="subhead" weight="semiBold">{caloriesIn} kcal</AppText>
                <AppText variant="caption2">Calories In</AppText>
              </AppView>
            </AppView>

            <AppView style={styles.statRow}>
              <View style={[styles.statDot, { backgroundColor: '#E07B39' }]} />
              <AppView>
                <AppText variant="subhead" weight="semiBold">{caloriesOut} kcal</AppText>
                <AppText variant="caption2">Calories Out</AppText>
              </AppView>
            </AppView>

            <AppView style={styles.statRow}>
              <View style={[styles.statDot, { backgroundColor: colors.mutedForeground }]} />
              <AppView>
                <AppText variant="subhead" weight="semiBold">{calorieGoal} kcal</AppText>
                <AppText variant="caption2">Daily Goal</AppText>
              </AppView>
            </AppView>
          </AppView>
        </AppView>

        <AppView style={styles.burnRow}>
          <AppText variant="caption1" weight="semiBold">Burned</AppText>
          <AppView style={styles.burnBarBg}>
            <View
              style={[
                styles.burnBarFill,
                {
                  width: `${Math.min(100, outPercent)}%` as any,
                  backgroundColor: '#E07B39',
                },
              ]}
            />
          </AppView>
          <AppText variant="caption2">{caloriesOut} kcal</AppText>
        </AppView>

        <AppView style={styles.macroRow}>
          <MacroPill label=" Protein" value={protein} unit="g" color="#2E7D62" />
          <MacroPill label=" Carbs" value={carbs} unit="g" color="#3A5FA0" />
          <MacroPill label=" Fat" value={fat} unit="g" color="#B04C78" />
        </AppView>
      </Card>
    );
  },
);

CalorieSummaryCard.displayName = 'CalorieSummaryCard';
