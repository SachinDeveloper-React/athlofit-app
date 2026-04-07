// ─── CalorieSummaryCard.tsx ────────────────────────────────────────────────────
// Shows Calories In vs Goal as a progress ring + Calories Out bar.

import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { AppText, AppView, Card } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  caloriesIn: number;
  caloriesOut: number;
  calorieGoal: number;
  protein: number;
  carbs: number;
  fat: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RING_SIZE = 100;
const STROKE = 10;
const R = (RING_SIZE - STROKE) / 2;
const CIRCUM = 2 * Math.PI * R;
const CX = RING_SIZE / 2;
const CY = RING_SIZE / 2;

// ─── Ring ─────────────────────────────────────────────────────────────────────

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
      {/* Track */}
      <Circle
        cx={CX}
        cy={CY}
        r={R}
        stroke={trackColor}
        strokeWidth={STROKE}
        fill="none"
      />
      {/* Fill */}
      <Circle
        cx={CX}
        cy={CY}
        r={R}
        stroke={color}
        strokeWidth={STROKE}
        fill="none"
        strokeDasharray={`${dash} ${gap}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${CX} ${CY})`}
      />
    </Svg>
  );
});

CalorieRing.displayName = 'CalorieRing';

// ─── Macro Pill ───────────────────────────────────────────────────────────────

interface MacroPillProps {
  label: string;
  value: number;
  unit: string;
  color: string;
}

const MacroPill = memo(({ label, value, unit, color }: MacroPillProps) => (
  <AppView style={styles.macroPill}>
    <View style={[styles.macroDot, { backgroundColor: color }]} />
    <AppText variant="caption2" weight="semiBold" color={color}>
      {value}
      {unit}
    </AppText>
    <AppText variant="caption2">{label}</AppText>
  </AppView>
));

MacroPill.displayName = 'MacroPill';

// ─── Main Component ───────────────────────────────────────────────────────────

export const CalorieSummaryCard = memo(
  ({ caloriesIn, caloriesOut, calorieGoal, protein, carbs, fat }: Props) => {
    const { colors } = useTheme();

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
        {/* ── Header ── */}
        <AppView style={styles.header}>
          <AppText variant="headline">Calories Today</AppText>
          <AppText variant="caption1" color={netColor} weight="semiBold">
            {netLabel}
          </AppText>
        </AppView>

        {/* ── Body ── */}
        <AppView style={styles.body}>
          {/* Ring */}
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

          {/* Stats column */}
          <AppView style={styles.statsCol}>
            {/* Calories In */}
            <AppView style={styles.statRow}>
              <View
                style={[
                  styles.statDot,
                  { backgroundColor: colors.primary },
                ]}
              />
              <AppView>
                <AppText variant="subhead" weight="semiBold">
                  {caloriesIn} kcal
                </AppText>
                <AppText variant="caption2">Calories In</AppText>
              </AppView>
            </AppView>

            {/* Calories Out */}
            <AppView style={styles.statRow}>
              <View style={[styles.statDot, { backgroundColor: '#E07B39' }]} />
              <AppView>
                <AppText variant="subhead" weight="semiBold">
                  {caloriesOut} kcal
                </AppText>
                <AppText variant="caption2">Calories Out</AppText>
              </AppView>
            </AppView>

            {/* Goal */}
            <AppView style={styles.statRow}>
              <View
                style={[
                  styles.statDot,
                  { backgroundColor: colors.mutedForeground },
                ]}
              />
              <AppView>
                <AppText variant="subhead" weight="semiBold">
                  {calorieGoal} kcal
                </AppText>
                <AppText variant="caption2">Daily Goal</AppText>
              </AppView>
            </AppView>
          </AppView>
        </AppView>

        {/* ── Burn bar ── */}
        <AppView style={styles.burnRow}>
          <AppText variant="caption1" weight="semiBold">
            Burned
          </AppText>
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

        {/* ── Macros ── */}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: { gap: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  statsCol: { flex: 1, gap: 10 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  burnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  burnBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  burnBarFill: {
    height: 6,
    borderRadius: 3,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 8,
  },
  macroPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  macroDot: { width: 6, height: 6, borderRadius: 3 },
});
