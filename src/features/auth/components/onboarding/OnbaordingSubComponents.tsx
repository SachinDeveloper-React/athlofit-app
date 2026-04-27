import React from 'react';
import {
  TouchableOpacity,
  Animated,
  StyleSheet,
} from 'react-native';
import { AppView, AppText } from '../../../../components';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';

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

export const StatCard: React.FC<StatCardProps> = ({ stat }) => {
  const { colors, spacing, radius, fontSize, fontWeight } = useTheme();
  return (
    <AppView style={[{
      backgroundColor: colors.overlayLight,
      borderRadius: radius.lg,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2.5],
      borderWidth: 1,
      borderColor: colors.overlayMedium,
      alignItems: 'center' as const,
    }]}>
      <AppText style={[{
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        textAlign: 'center' as const,
        color: stat.color,
      }]}>{stat.value}</AppText>
      <AppText style={{
        color: colors.mutedForeground,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        letterSpacing: 1.5,
        textAlign: 'center' as const,
        marginTop: spacing[0.5],
      }}>{stat.label}</AppText>
    </AppView>
  );
};

// ─── MacroRow ─────────────────────────────────────────────────────────────

export const MacroRow: React.FC<MacroRowProps> = ({ macro, widthAnim }) => {
  const { colors, spacing, radius, fontSize, fontWeight } = useTheme();
  const animatedWidth = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${macro.pct * 100}%`],
  });

  return (
    <AppView style={{ marginBottom: spacing[3] }}>
      <AppView style={{
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        marginBottom: spacing[1.5],
      }}>
        <AppText style={{ color: colors.primaryForeground, fontSize: fontSize.sm, fontWeight: fontWeight.semiBold }}>{macro.label}</AppText>
        <AppText style={[{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: macro.color }]}>
          {macro.val}
        </AppText>
      </AppView>
      <AppView style={{
        height: spacing[2],
        backgroundColor: withOpacity(colors.primaryForeground, 0.08),
        borderRadius: radius.xs,
      }}>
        <Animated.View
          style={[
            { height: spacing[2], borderRadius: radius.xs },
            { width: animatedWidth, backgroundColor: macro.color },
          ]}
        />
      </AppView>
    </AppView>
  );
};

// ─── GoalRing ─────────────────────────────────────────────────────────────

export const GoalRing: React.FC<GoalRingProps> = ({ goal }) => {
  const { colors, spacing, fontSize, fontWeight } = useTheme();
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
            stroke={withOpacity(colors.primaryForeground, 0.07)}
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
        <AppView style={[StyleSheet.absoluteFillObject, { alignItems: 'center' as const, justifyContent: 'center' as const }]}>
          <AppText style={[{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: goal.color }]}>
            {Math.round(goal.pct * 100)}%
          </AppText>
        </AppView>
      </AppView>
      <AppText style={{
        color: colors.mutedForeground,
        fontSize: fontSize.xs,
        marginTop: spacing[1],
        fontWeight: fontWeight.semiBold,
      }}>{goal.label}</AppText>
      <AppText style={{ color: colors.primaryForeground, fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>{goal.curr}</AppText>
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

export const BpRow: React.FC<BpRowProps> = ({ item }) => {
  const { colors, spacing, radius, fontSize, fontWeight } = useTheme();
  return (
    <AppView style={{ marginBottom: spacing[3] }}>
      <AppView style={{
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        marginBottom: spacing[1.5],
      }}>
        <AppText style={{ color: colors.mutedForeground, fontSize: fontSize.sm, fontWeight: fontWeight.semiBold }}>{item.label}</AppText>
        <AppText style={[{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: item.color }]}>{item.val} mmHg</AppText>
      </AppView>
      <AppView style={{
        height: spacing[2],
        backgroundColor: withOpacity(colors.primaryForeground, 0.08),
        borderRadius: radius.xs,
      }}>
        <Animated.View
          style={[
            { height: spacing[2], borderRadius: radius.xs },
            { width: item.animatedWidth, backgroundColor: item.color },
          ]}
        />
      </AppView>
    </AppView>
  );
};

// ─── ProgressBar ──────────────────────────────────────────────────────────

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color,
}) => {
  const { colors, spacing } = useTheme();
  return (
    <AppView style={{
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      backgroundColor: withOpacity(colors.primaryForeground, 0.08),
      zIndex: 10,
    }}>
      <Animated.View
        style={[{ height: 3, borderRadius: 2 }, { width: progress, backgroundColor: color }]}
      />
    </AppView>
  );
};

// ─── Dots ─────────────────────────────────────────────────────────────────

export const Dots: React.FC<DotsProps> = ({
  slides,
  activeIndex,
  accent,
  onPress,
}) => {
  const { colors, spacing, radius } = useTheme();
  return (
    <AppView style={{
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing[2],
      marginBottom: spacing[7],
    }}>
      {slides.map((_, i) => (
        <TouchableOpacity
          key={i}
          onPress={() => onPress(i)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <AppView
            style={[
              { height: spacing[2], borderRadius: radius.xs },
              {
                width: i === activeIndex ? 24 : 8,
                backgroundColor:
                  i === activeIndex ? accent : colors.overlayHeavy,
              },
            ]}
          />
        </TouchableOpacity>
      ))}
    </AppView>
  );
};

// ─── NextButton ───────────────────────────────────────────────────────────

export const NextButton: React.FC<NextButtonProps> = ({
  isLast,
  accent,
  scale,
  onPress,
}) => {
  const { colors, spacing, radius, fontSize, fontWeight, shadow } = useTheme();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        <AppView
          style={[{
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            height: 56,
            borderRadius: radius['3xl'],
            backgroundColor: accent,
            shadowColor: accent,
          }, shadow.lg]}
        >
          <AppText style={{
            color: colors.primaryForeground,
            fontSize: fontSize.lg,
            fontWeight: fontWeight.bold,
            letterSpacing: 0.3,
          }}>
            {isLast ? 'Get Started 🚀' : 'Continue'}
          </AppText>
          {!isLast && (
            <Svg
              width={20}
              height={20}
              viewBox="0 0 20 20"
              style={{ marginLeft: spacing[2] }}
            >
              <Path
                d="M8 4l6 6-6 6"
                stroke={colors.primaryForeground}
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
};

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
