import React from 'react';
import {
  TouchableOpacity,
  Animated,
  StyleSheet,
} from 'react-native';
import { AppView, AppText } from '../../../../components';
import Svg, { Path } from 'react-native-svg';

import type {
  StatCardProps,
  MacroRowProps,
  GoalRingProps,
  BpRowProps,
  ProgressBarProps,
  DotsProps,
  NextButtonProps,
} from '../../types';
import { C } from '../../constant';

// ─── StatCard ─────────────────────────────────────────────────────────────

export const StatCard: React.FC<StatCardProps> = ({ stat }) => (
  <AppView style={styles.statCard}>
    <AppText style={[styles.statValue, { color: stat.color }]}>{stat.value}</AppText>
    <AppText style={styles.statLabel}>{stat.label}</AppText>
  </AppView>
);

// ─── MacroRow ─────────────────────────────────────────────────────────────

export const MacroRow: React.FC<MacroRowProps> = ({ macro, widthAnim }) => {
  const animatedWidth = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${macro.pct * 100}%`],
  });

  return (
    <AppView style={styles.macroRow}>
      <AppView style={styles.macroHeader}>
        <AppText style={styles.macroLabel}>{macro.label}</AppText>
        <AppText style={[styles.macroVal, { color: macro.color }]}>
          {macro.val}
        </AppText>
      </AppView>
      <AppView style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            { width: animatedWidth, backgroundColor: macro.color },
          ]}
        />
      </AppView>
    </AppView>
  );
};

// ─── GoalRing ─────────────────────────────────────────────────────────────

export const GoalRing: React.FC<GoalRingProps> = ({ goal }) => {
  const R = 54;
  const cx = R + 8;
  const circ = 2 * Math.PI * R;
  const size = cx * 2 + 16;

  return (
    <AppView style={{ alignItems: 'center' }}>
      <AppView style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* Track */}
          <Path
            d={describeArc(cx + 8, cx + 8, R, 0, 359.99)}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={8}
          />
          {/* Progress */}
          <Path
            d={describeArc(cx + 8, cx + 8, R, 0, goal.pct * 359.99)}
            fill="none"
            stroke={goal.color}
            strokeWidth={8}
            strokeLinecap="round"
          />
        </Svg>
        {/* Centred label */}
        <AppView style={[StyleSheet.absoluteFillObject, styles.ringCenter]}>
          <AppText style={[styles.ringPct, { color: goal.color }]}>
            {Math.round(goal.pct * 100)}%
          </AppText>
        </AppView>
      </AppView>
      <AppText style={styles.ringGoalLabel}>{goal.label}</AppText>
      <AppText style={styles.ringGoalCurr}>{goal.curr}</AppText>
    </AppView>
  );
};

// SVG arc path helper
function describeArc(
  x: number,
  y: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(x, y, r, endAngle);
  const end = polarToCartesian(x, y, r, startAngle);
  const large = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
}

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  deg: number,
): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// ─── BpRow ────────────────────────────────────────────────────────────────

export const BpRow: React.FC<BpRowProps> = ({ item }) => (
  <AppView style={styles.bpRow}>
    <AppView style={styles.bpHeader}>
      <AppText style={styles.bpLabel}>{item.label}</AppText>
      <AppText style={[styles.bpVal, { color: item.color }]}>{item.val} mmHg</AppText>
    </AppView>
    <AppView style={styles.barTrack}>
      <Animated.View
        style={[
          styles.barFill,
          { width: item.animatedWidth, backgroundColor: item.color },
        ]}
      />
    </AppView>
  </AppView>
);

// ─── ProgressBar ──────────────────────────────────────────────────────────

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color,
}) => (
  <AppView style={styles.progressTrack}>
    <Animated.View
      style={[styles.progressFill, { width: progress, backgroundColor: color }]}
    />
  </AppView>
);

// ─── Dots ─────────────────────────────────────────────────────────────────

export const Dots: React.FC<DotsProps> = ({
  slides,
  activeIndex,
  accent,
  onPress,
}) => (
  <AppView style={styles.dots}>
    {slides.map((_, i) => (
      <TouchableOpacity
        key={i}
        onPress={() => onPress(i)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <AppView
          style={[
            styles.dot,
            {
              width: i === activeIndex ? 24 : 8,
              backgroundColor:
                i === activeIndex ? accent : 'rgba(255,255,255,0.2)',
            },
          ]}
        />
      </TouchableOpacity>
    ))}
  </AppView>
);

// ─── NextButton ───────────────────────────────────────────────────────────

export const NextButton: React.FC<NextButtonProps> = ({
  isLast,
  accent,
  scale,
  onPress,
}) => (
  <Animated.View style={{ transform: [{ scale }] }}>
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <AppView
        style={[styles.btn, { backgroundColor: accent, shadowColor: accent }]}
      >
        <AppText style={styles.btnText}>
          {isLast ? 'Get Started 🚀' : 'Continue'}
        </AppText>
        {!isLast && (
          <Svg
            width={20}
            height={20}
            viewBox="0 0 20 20"
            style={{ marginLeft: 8 }}
          >
            <Path
              d="M8 4l6 6-6 6"
              stroke={C.white}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        )}
      </AppView>
    </TouchableOpacity>
  </Animated.View>
);

// ─── STYLES ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // StatCard
  statCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  statLabel: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 2,
  },

  // MacroRow
  macroRow: { marginBottom: 12 },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  macroLabel: { color: C.white, fontSize: 13, fontWeight: '600' },
  macroVal: { fontSize: 13, fontWeight: '800' },

  // Bar (shared)
  barTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
  },
  barFill: { height: 8, borderRadius: 4 },

  // GoalRing
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  ringPct: { fontSize: 13, fontWeight: '900' },
  ringGoalLabel: {
    color: C.muted,
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  ringGoalCurr: { color: C.white, fontSize: 11, fontWeight: '700' },

  // BpRow
  bpRow: { marginBottom: 12 },
  bpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  bpLabel: { color: C.muted, fontSize: 12, fontWeight: '600' },
  bpVal: { fontSize: 14, fontWeight: '800' },

  // ProgressBar
  progressTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    zIndex: 10,
  },
  progressFill: { height: 3, borderRadius: 2 },

  // Dots
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 28,
  },
  dot: { height: 8, borderRadius: 4 },

  // NextButton
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 28,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  btnText: {
    color: C.white,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
