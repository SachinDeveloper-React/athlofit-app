import React from 'react';
import { Animated, Dimensions, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { AppView, AppText } from '../../../../components';
import { GoalItem } from '../../types';
import { C } from '../../constant';
import { useLoopAnim } from '../../hooks';
import { GoalRing } from './OnbaordingSubComponents';

const { width, height: screenHeight } = Dimensions.get('window');

const GOALS: GoalItem[] = [
  {
    label: 'Steps',
    target: '10,000',
    curr: '8,430',
    pct: 0.843,
    color: C.teal,
  },
  {
    label: 'Calories',
    target: '2,200',
    curr: '1,740',
    pct: 0.79,
    color: C.accent,
  },
  {
    label: 'Active',
    target: '60 min',
    curr: '47 min',
    pct: 0.78,
    color: C.gold,
  },
];

export const GoalScene: React.FC = () => {
  const glowAnim = useLoopAnim({
    initialValue: 0.6,
    steps: [
      { toValue: 1, duration: 1500 },
      { toValue: 0.6, duration: 1500 },
    ],
  });

  const bigR = 64;
  const circ = 2 * Math.PI * bigR;
  const score = 87;
  const dash = circ * 0.87;

  return (
    <AppView style={styles.root}>
      {/* Main score ring */}
      <Animated.View style={[styles.mainRingWrap, { opacity: glowAnim }]}>
        <Svg width={160} height={160} viewBox="0 0 160 160">
          <Defs>
            <LinearGradient id="rg1" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={C.teal} />
              <Stop offset="1" stopColor={C.blue} />
            </LinearGradient>
          </Defs>
          {/* Track */}
          <Circle
            cx={80}
            cy={80}
            r={bigR}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={14}
          />
          {/* Progress */}
          <Circle
            cx={80}
            cy={80}
            r={bigR}
            fill="none"
            stroke="url(#rg1)"
            strokeWidth={14}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            rotation="-90"
            origin="80,80"
          />
          <Circle cx={80} cy={80} r={48} fill="rgba(0,229,195,0.05)" />
        </Svg>

        {/* Score overlay */}
        <AppView style={styles.scoreOverlay}>
          <AppText style={styles.scoreNumber}>{score}</AppText>
          <AppText style={styles.scoreLabel}>SCORE</AppText>
        </AppView>
      </Animated.View>

      {/* Goal rings row */}
      <AppView style={styles.ringsRow}>
        {GOALS.map(g => (
          <GoalRing key={g.label} goal={g} />
        ))}
      </AppView>

      {/* CTA */}
      <AppView style={styles.cta}>
        <AppText style={styles.ctaHeadline}>You're almost there! 🔥</AppText>
        <AppText style={styles.ctaBody}>Keep moving to hit today's goals</AppText>
      </AppView>
    </AppView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  mainRingWrap: { marginTop: -(screenHeight * 0.06) },

  scoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: { color: '#fff', fontSize: 36, fontWeight: '900' },
  scoreLabel: {
    color: C.teal,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },

  ringsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: width * 0.85,
    marginTop: 16,
  },

  cta: { marginTop: 20, alignItems: 'center' },
  ctaHeadline: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  ctaBody: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
});
