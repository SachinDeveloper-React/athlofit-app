import React, { memo, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
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
import { AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { WeeklyStepEntry } from '../../types/healthTypes';

// ─── Constants ────────────────────────────────────────────────────────────────

const CX = 130;
const CY = 130;
const R = 100;
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
  todayIndex?: number;
  style?: ViewStyle;
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
};

const Speedometer = memo(
  ({ steps, goal, foreground, muted, border, bg }: SpeedometerProps) => {
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

    // Needle — plain number prop, Reanimated passes it through to RNSVG safely
    const needleRotationProps = useAnimatedProps(() => ({
      rotation: NEEDLE_MIN + (NEEDLE_MAX - NEEDLE_MIN) * progress.value,
    }));

    const pct = Math.min(Math.round((steps / goal) * 100), 100);

    return (
      <View style={styles.speedoContainer}>
        <Svg width={260} height={150} viewBox="0 0 260 150">
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
        <View style={styles.speedoCenterInfo} pointerEvents="none">
          <AppText variant="title2" weight="medium" style={styles.stepsVal}>
            {steps.toLocaleString()}/
            <AppText variant="caption1">{goal}</AppText>
          </AppText>
          <AppText variant="caption1" style={styles.stepsLbl}>
            steps today
          </AppText>
          <AppText variant="caption2" style={styles.pctLbl}>
            {steps >= goal ? 'Goal reached!' : `${pct}% of goal`}
          </AppText>
        </View>
      </View>
    );
  },
);

Speedometer.displayName = 'Speedometer';

// ─── DayBar ───────────────────────────────────────────────────────────────────

type DayBarProps = {
  data: WeeklyStepEntry;
  goal: number;
  maxSteps: number;
  isToday: boolean;
};

const DayBar = memo(({ data, goal, maxSteps, isToday }: DayBarProps) => {
  const { colors } = useTheme();

  const met = data.steps >= goal;
  const targetH = Math.round((data.steps / maxSteps) * BAR_H);
  const goalLineY = Math.round((goal / maxSteps) * BAR_H);

  const fillH = useSharedValue(0);

  useEffect(() => {
    fillH.value = withTiming(targetH, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [targetH, fillH]);

  // ✅ Height-only animated style — no color here
  const animHeightStyle = useAnimatedStyle(() => ({
    height: fillH.value,
  }));

  // ✅ Color lives in a plain style object, merged separately so RN can
  //    read it without going through the Reanimated style resolver.
  const barColor = met ? '#1D9E75' : isToday ? '#378ADD' : colors.muted;

  return (
    <View style={styles.dayCol}>
      {/* Goal indicator dot */}
      <View
        style={[
          styles.checkmark,
          { backgroundColor: met ? '#1D9E75' : colors.border },
        ]}
      >
        {met && <AppText style={styles.checkIcon}>✓</AppText>}
      </View>

      {/* Bar */}
      <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
        {/* ✅ Animated.View only handles height; barColor style is separate */}
        <Animated.View
          style={[
            styles.barFill,
            { backgroundColor: barColor },
            animHeightStyle,
          ]}
        />

        {/* Goal reference line */}
        <View style={[styles.goalLine, { bottom: goalLineY }]} />
      </View>

      <AppText variant="caption2" style={styles.daySteps}>
        {(data.steps / 1000).toFixed(1)}k
      </AppText>
      <AppText
        variant="caption2"
        style={[styles.dayName, isToday && styles.dayNameToday]}
      >
        {data.date}
      </AppText>
    </View>
  );
});

DayBar.displayName = 'DayBar';

// ─── StepProgressCard ─────────────────────────────────────────────────────────

export const StepProgressCard = memo(
  ({ steps, goal = 10000, weekData, todayIndex, style }: Props) => {
    const { colors, radius } = useTheme();

    const todayIdx = todayIndex ?? weekData.length - 1;

    const maxSteps = useMemo(
      () => Math.max(...weekData.map(d => d.steps), goal),
      [weekData, goal],
    );

    return (
      <View style={[styles.card, { borderRadius: radius.lg }, style]}>
        <Speedometer
          steps={steps}
          goal={goal}
          foreground={colors.foreground}
          muted={colors.muted}
          border={colors.border}
          bg={colors.background}
        />

        <AppText
          variant="caption1"
          style={[styles.weekLabel, { color: colors.muted }]}
        >
          This week
        </AppText>

        <View style={styles.weekGrid}>
          {weekData.map((day, i) => (
            <DayBar
              key={`${day.date}-${i}`}
              data={day}
              goal={goal}
              maxSteps={maxSteps}
              isToday={i === todayIdx}
            />
          ))}
        </View>
      </View>
    );
  },
);

StepProgressCard.displayName = 'StepProgressCard';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    padding: 20,
  },

  // Speedometer
  speedoContainer: {
    alignItems: 'center',
    marginBottom: 24,
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
    marginBottom: 12,
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    opacity: 0.6,
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
});
