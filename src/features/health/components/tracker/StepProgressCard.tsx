import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  StyleSheet,
  TouchableOpacity,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Path,
  Circle,
  Rect,
  Line,
  Defs,
  LinearGradient,
  Stop,
  G,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { AppText, AppView, Icon, IconButton } from '../../../../components';
import { Skeleton } from '../../../../components/SkeletonLoader';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { makeStyles } from '../../../../hooks/makeStyles';
import { WeeklyStepEntry } from '../../types/healthTypes';
import { navigate } from '../../../../navigation/navigationRef';
import { getStepColor } from '../../utils/stepColorUtils';
import { HealthRoutes, RootRoutes } from '../../../../navigation/routes';
import { useHealthDataStore } from '../../store/healthDataStore';

// ─── Constants ────────────────────────────────────────────────────────────────

const SVG_W = 360;   // matches typical screen width; SVG uses width="100%"
const CX = SVG_W / 2;  // 180
const CY = 150;
const R = 130;

const START_DEG = 160;
const END_DEG = 380; // 280° sweep
const SWEEP = END_DEG - START_DEG;
const NEEDLE_MIN = -130;
const NEEDLE_MAX = 130;
const BAR_H = 80;
const BAR_W = 22;

type Props = {
  steps: number;
  goal?: number;
  weekData: WeeklyStepEntry[];
  todayIndex?: string; // ISO date "YYYY-MM-DD" for today matching
  style?: ViewStyle;
  isWeekPending?: boolean;
  claimedToday?: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function degToRad(d: number) {
  'worklet';
  return (d * Math.PI) / 180;
}

function polarPoint(deg: number, r: number): [number, number] {
  'worklet';
  const rad = degToRad(deg);
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

function buildArcPath(startDeg: number, endDeg: number, r: number): string {
  'worklet';
  const [x1, y1] = polarPoint(startDeg, r);
  const [x2, y2] = polarPoint(endDeg, r);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const fmt = (n: number) => Math.round(n * 100) / 100;
  return `M ${fmt(x1)} ${fmt(y1)} A ${r} ${r} 0 ${large} 1 ${fmt(x2)} ${fmt(
    y2,
  )}`;
}

// ─── Precomputed statics ──────────────────────────────────────────────────────

// Full arc path — used for both track and the dash-based progress
const FULL_ARC = buildArcPath(START_DEG, END_DEG, R);

// Tick mark coordinates
const TICKS = Array.from({ length: 11 }, (_, i) => {
  const deg = START_DEG + (SWEEP * i) / 10;
  const isMajor = i % 5 === 0;
  const [x1, y1] = polarPoint(deg, isMajor ? 83 : 88);
  const [x2, y2] = polarPoint(deg, 92);
  return { x1, y1, x2, y2, isMajor };
});

// ─── Animated SVG components ──────────────────────────────────────────────────

const AnimatedG = Animated.createAnimatedComponent(G);

// ─── Speedometer ──────────────────────────────────────────────────────────────

type SpeedometerProps = {
  steps: number;
  goal: number;
  foreground: string;
  muted: string;
  border: string;
  bg: string;
  onEditGoal: () => void;
};

const Speedometer = memo(
  ({
    steps,
    goal,
    foreground,
    muted,
    border,
    bg,
    onEditGoal,
  }: SpeedometerProps) => {
    const progress = useSharedValue(0);

    // Arc path lives in React state — plain string, no Reanimated involvement.
    // useAnimatedReaction fires on the UI thread each frame progress changes,
    // then runOnJS bridges the computed path string back to the JS thread.
    // RNSVG receives a clean `d` prop and re-renders only the progress Path.
    const [arcD, setArcD] = useState(FULL_ARC);

    const updateArc = (ratio: number) => {
      const endDeg = START_DEG + SWEEP * Math.min(ratio, 0.9999);
      setArcD(buildArcPath(START_DEG, endDeg, R));
    };

    useAnimatedReaction(
      () => progress.value,
      current => {
        if (current > 0.001) runOnJS(updateArc)(current);
      },
    );

    useEffect(() => {
      progress.value = withTiming(Math.min(steps / goal, 1), {
        duration: 900,
        easing: Easing.out(Easing.cubic),
      });
    }, [steps, goal]);

    // // Needle — plain number prop, Reanimated passes it through to RNSVG safely
    // const needleRotationProps = useAnimatedProps(() => ({
    //   rotation: NEEDLE_MIN + (NEEDLE_MAX - NEEDLE_MIN) * progress.value,
    // }));

    const pct = Math.min(Math.round((steps / goal) * 100), 100);

    return (
      <AppView style={styles.speedoContainer}>
        <Svg width="100%" height={180} viewBox={`0 0 ${SVG_W} 180`}>
          <Defs>
            <LinearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#378ADD" />
              <Stop offset="50%" stopColor="#1D9E75" />
              <Stop offset="100%" stopColor="#BA7517" />
            </LinearGradient>
          </Defs>

          {/* Track (full arc, always visible) */}
          <Path
            d={FULL_ARC}
            fill="none"
            stroke={border}
            strokeWidth={18}
            strokeLinecap="round"
          />

          {/* Progress arc — driven by JS-thread state, no Reanimated on `d` */}
          <Path
            d={arcD}
            fill="none"
            stroke="url(#arcGrad)"
            strokeWidth={18}
            strokeLinecap="round"
          />

          {/* Tick marks */}
          {TICKS.map((t, i) => (
            <Line
              key={i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.isMajor ? muted : border}
              strokeWidth={t.isMajor ? 1.5 : 1}
            />
          ))}

          {/* Needle — rotation is a plain number, origin handles pivot */}
          {/* <AnimatedG
            animatedProps={needleRotationProps}
            origin={`${CX}, ${CY}`}
          >
            <Rect
              x={CX - 2}
              y={60}
              width={4}
              height={72}
              rx={2}
              fill={foreground}
              opacity={0.7}
            />
            <Circle cx={CX} cy={CY} r={7} fill={foreground} opacity={0.85} />
            <Circle cx={CX} cy={CY} r={3.5} fill={bg} />
          </AnimatedG> */}
        </Svg>

        {/* Centre overlay text */}
        <AppView style={[styles.speedoCenterInfo, { bottom: 4 }]}>
          <AppView style={styles.goalRow}>
          <AppText variant="title1" weight="medium" style={styles.stepsVal}>
            {steps.toLocaleString()}/
          </AppText>
           <AppView style={styles.goalRow} pointerEvents="auto">
              <AppText variant="caption1">{goal}</AppText>
              <IconButton name='Pencil'  borderColor={border} borderRadius={10} onPress={onEditGoal} />
            </AppView>

</AppView>
          <AppText variant="caption1" style={styles.stepsLbl}>
            Steps Today
          </AppText>
          <AppText variant="caption2" style={styles.pctLbl}>
            {steps >= goal ? 'Goal reached!' : `${pct}% of goal`}
          </AppText>
        </AppView>
      </AppView>
    );
  },
);

Speedometer.displayName = 'Speedometer';

// ─── DayBar ───────────────────────────────────────────────────────────────────

type DayBarProps = {
  data: WeeklyStepEntry;
  currentGoal: number; // today's / current goal — used for bars with no snapshot
  maxSteps: number;
  isToday: boolean;
};

const DayBar = memo(({ data, currentGoal, maxSteps, isToday }: DayBarProps) => {
  const { colors } = useTheme();

  // Use the goal that was active on that specific day if available,
  // otherwise fall back to the current goal (e.g. today or unsynced days).
  const goal = data.goalSnapshot && data.goalSnapshot > 0 ? data.goalSnapshot : currentGoal;

  // ── Color derived from progress ratio ─────────────────────────────────────
  const { barColor, dotColor, ratio } = useMemo(
    () => getStepColor(data.steps, goal, colors.muted, isToday),
    [data.steps, goal, colors.muted, isToday],
  );

  const met      = ratio >= 1;
  const targetH  = maxSteps > 0 ? Math.round((data.steps / maxSteps) * BAR_H) : 0;
  const goalLineY = maxSteps > 0 ? Math.round((goal / maxSteps) * BAR_H) : 0;

  // ── Animated bar height ───────────────────────────────────────────────────
  const fillH = useSharedValue(0);
  useEffect(() => {
    fillH.value = withTiming(targetH, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [targetH]);

  const animHeightStyle = useAnimatedStyle(() => ({ height: fillH.value }));

  // ── Step label: show "Xk" or "—" ─────────────────────────────────────────
  const stepLabel = data.steps > 0
    ? data.steps >= 1000
      ? `${(data.steps / 1000).toFixed(1)}k`
      : String(data.steps)
    : '—';

  // ── Navigate to StepDetailScreen ─────────────────────────────────────────
  const handlePress = useCallback(() => {
    if (!data.fullDate) return;
    navigate(RootRoutes.HEALTH_NAVIGATOR, {
      screen: HealthRoutes.STEP_DETAIL,
      params: { date: data.fullDate },
    });
  }, [data.fullDate]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={data.fullDate ? 0.7 : 1}
      style={styles.dayCol}
    >
      {/* ── Goal dot / checkmark ── */}
      <AppView
        style={[
          styles.checkmark,
          {
            backgroundColor: met
              ? dotColor
              : data.steps > 0
              ? withOpacity(dotColor, 0.25)
              : colors.border,
          },
        ]}
      >
        {met && <AppText style={styles.checkIcon}>✓</AppText>}
      </AppView>

      {/* ── Bar track ── */}
      <AppView style={[styles.barTrack, { backgroundColor: colors.border }]}>
        {/* Animated fill — color + height */}
        <Animated.View
          style={[
            styles.barFill,
            { backgroundColor: barColor },
            animHeightStyle,
          ]}
        />

        {/* Goal reference line */}
        {goalLineY > 0 && goalLineY < BAR_H && (
          <AppView
            style={[
              styles.goalLine,
              {
                bottom: goalLineY,
                backgroundColor: withOpacity('#BA7517', met ? 0 : 0.55),
              },
            ]}
          />
        )}
      </AppView>

      {/* ── Step count ── */}
      <AppText
        variant="caption2"
        style={[
          styles.daySteps,
          { color: data.steps > 0 ? barColor : colors.mutedForeground },
        ]}
      >
        {stepLabel}
      </AppText>

      {/* ── Day name ── */}
      <AppText
        variant="caption2"
        style={[
          styles.dayName,
          isToday && styles.dayNameToday,
          isToday && { color: colors.primary },
        ]}
      >
        {data.date}
      </AppText>
    </TouchableOpacity>
  );
});

DayBar.displayName = 'DayBar';

// ─── ClaimCoinsButton ─────────────────────────────────────────────────────────

type ClaimProps = {
  steps: number;
  goal: number;
  claimedToday?: boolean;
};

const COINS_FOR_GOAL = 50;
const COINS_PARTIAL = 10;

const ClaimCoinsButton = memo(({ steps, goal, claimedToday }: ClaimProps) => {
  const { colors } = useTheme();
  const pct = steps / goal;
  const goalMet = pct >= 1;

  // Only show the claimed badge when goal is met — coins are auto-credited
  if (!goalMet && !claimedToday) return null;

  const claimedBg = withOpacity(colors.primary, 0.12);

  return (
    <AppView style={styles.claimWrap}>
      <AppView style={[styles.claimedBadge, { backgroundColor: claimedBg }]}>
        <AppText style={[styles.claimedText, { color: colors.primary }]}>
          {claimedToday ? '✓ Coins credited today!' : '🎯 Goal reached — coins incoming!'}
        </AppText>
      </AppView>
    </AppView>
  );
});

ClaimCoinsButton.displayName = 'ClaimCoinsButton';

// ─── Legend items ─────────────────────────────────────────────────────────────

const LEGEND_ITEMS = [
  { color: '#C5DFF7', label: '<25%'  },
  { color: '#5AABF0', label: '25–50%' },
  { color: '#2E9FD8', label: '50–75%' },
  { color: '#1DB88A', label: '75–99%' },
  { color: '#16A34A', label: '100% ✓' },
] as const;

// ─── StepProgressCard ─────────────────────────────────────────────────────────

export const StepProgressCard = memo(
  ({
    steps,
    goal = 10000,
    weekData,
    todayIndex,
    style,
    isWeekPending,
    claimedToday,
  }: Props) => {
    const { colors, radius } = useTheme();

    const todayIdx = todayIndex ?? "";

    const maxSteps = useMemo(
      () => Math.max(...weekData.map(d => d.steps), goal),
      [weekData, goal],
    );

    const onEditGoal = useCallback(() => {
      navigate('HealthStack', {
        screen: 'EditStepsGoalScreen',
      });
    }, []);

    // Read bonus steps for today from store
    const todayBonusSteps = useHealthDataStore(s => {
      const today = new Date().toISOString().split('T')[0];
      return s.bonusStepsDate === today ? s.bonusSteps : 0;
    });

    return (
      <AppView style={[styles.card, { borderRadius: radius.lg }, style]}>
        <Speedometer
          steps={steps}
          goal={goal}
          foreground={colors.foreground}
          muted={colors.muted}
          border={colors.border}
          bg={colors.background}
          onEditGoal={onEditGoal}
        />

        {/* Bonus steps indicator */}
        {todayBonusSteps > 0 && (
          <AppView style={styles.bonusBadge}>
            <AppText variant="caption2" style={{ color: '#1D9E75', fontWeight: '600' }}>
              🎁 +{todayBonusSteps.toLocaleString()} bonus steps added
            </AppText>
          </AppView>
        )}

        {/* Goal reached badge — coins are auto-credited via useSyncHealth */}
        <ClaimCoinsButton
          steps={steps}
          goal={goal}
          claimedToday={claimedToday}
        />

        {isWeekPending ? (
          <AppView style={{ marginTop: 24 }}>
            <Skeleton width={80} height={14} style={{ marginBottom: 12 }} />
            <AppView style={styles.weekGrid}>
              {Array.from({ length: 7 }).map((_, i) => (
                <AppView key={i} style={styles.dayCol}>
                  <Skeleton width={16} height={16} radius="full" />
                  <Skeleton width={22} height={80} radius="full" />
                  <Skeleton width={20} height={10} />
                  <Skeleton width={22} height={12} />
                </AppView>
              ))}
            </AppView>
          </AppView>
        ) : weekData && weekData.length > 0 ? (
          <AppView style={{ marginTop: 24 }}>
            {/* ── Section header with goal ── */}
            <AppView style={styles.weekHeader}>
              <AppText variant="caption1" style={styles.weekLabel}>
                This week
              </AppText>
              <AppText variant="caption2" style={styles.weekGoalLabel}>
                Goal: {goal.toLocaleString()} steps
              </AppText>
            </AppView>

            {/* ── Color legend ── */}
            <AppView style={styles.legendRow}>
              {LEGEND_ITEMS.map(item => (
                <AppView key={item.label} style={styles.legendItem}>
                  <AppView style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <AppText variant="caption2" style={styles.legendText}>
                    {item.label}
                  </AppText>
                </AppView>
              ))}
            </AppView>

            <AppView style={styles.weekGrid}>
              {weekData.map((day, i) => (
                <DayBar
                  key={`${day.fullDate || day.date}-${i}`}
                  data={day}
                  currentGoal={goal}
                  maxSteps={maxSteps}
                  isToday={day.fullDate === todayIdx}
                />
              ))}
            </AppView>
          </AppView>
        ) : null}
      </AppView>
    );
  },
);

StepProgressCard.displayName = 'StepProgressCard';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    paddingVertical: 20,
    paddingHorizontal: 0,
  },

  // Speedometer
speedoContainer: {
  alignItems: 'center',
  marginBottom: 24,
  width: '100%',      // ← add this
  alignSelf: 'stretch',
},
  speedoCenterInfo: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
  },
  stepsVal: {
    lineHeight: 32,
  },
  stepsLbl: {
    marginTop: 2,
  },
  pctLbl: {
    marginTop: 2,
    opacity: 0.6,
  },

  // Week grid
  weekLabel: {
    marginBottom: 4,
    paddingHorizontal: 20,
  },
  weekGoalLabel: {
    opacity: 0.55,
    paddingHorizontal: 20,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    // paddingHorizontal: 20,
    marginBottom: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 9,
    opacity: 0.7,
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },

  // Day bar
  dayCol: {
    alignItems: 'center',
    gap: 4,
  },
  checkmark: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    fontSize: 9,
    color: '#fff',
    lineHeight: 12,
  },
  barTrack: {
    width: BAR_W,
    height: BAR_H,
    borderRadius: 11,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: BAR_W,
    borderRadius: 11,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(186,117,23,0.55)',
  },
  daySteps: {
    fontSize: 10,
    textAlign: 'center',
  },
  dayName: {
    fontSize: 11,
    opacity: 0.7,
  },
  dayNameToday: {
    opacity: 1,
    fontWeight: '500',
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  bonusBadge: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(29, 158, 117, 0.08)',
    alignSelf: 'center',
    marginBottom: 4,
  },

  editBtn: {
    marginLeft: 4,
    padding: 0,
  },

  // Claim Coins Button
  claimWrap: {
    marginTop: 8,
    marginBottom: 4,
  },
  claimBtn: {
    borderRadius: 16,
    shadowColor: '#F5C518',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
    alignSelf: 'stretch',
  },
  coinEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  claimTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F5C518',
    letterSpacing: 0.2,
  },
  claimedBadge: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  claimedText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
