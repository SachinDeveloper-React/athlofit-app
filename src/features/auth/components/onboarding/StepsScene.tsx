import React from 'react';
import { Animated, Dimensions, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Path,
  Rect,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { AppView, AppText } from '../../../../components';
import { C } from '../../constant';
import { useLoopAnim, useEnterAnim } from '../../hooks';

const { width } = Dimensions.get('window');

export const StepsScene: React.FC = () => {
  // Ring progress animation
  const progressAnim = useLoopAnim({
    initialValue: 0.6,
    steps: [
      { toValue: 1, duration: 2000 },
      { toValue: 0.6, duration: 2000 },
    ],
  });

  // Step count pulse
  const pulseAnim = useLoopAnim({
    initialValue: 1,
    steps: [
      { toValue: 1.05, duration: 800 },
      { toValue: 1, duration: 800 },
    ],
  });

  // Bar chart entry
  const barEnter = useEnterAnim({
    toValue: 1,
    duration: 1200,
    useNativeDriver: false,
  });

  const R = 60;
  const circ = 2 * Math.PI * R;
  const steps = 8430;
  const goal = 10000;
  const pct = steps / goal;
  const dash = circ * pct;

  // Weekly bar data
  const BARS = [
    { day: 'M', pct: 0.7 },
    { day: 'T', pct: 0.9 },
    { day: 'W', pct: 0.6 },
    { day: 'T', pct: 0.85 },
    { day: 'F', pct: 0.95 },
    { day: 'S', pct: 0.5 },
    { day: 'S', pct: 0.4 },
  ];

  return (
    <AppView style={styles.root}>
      {/* Steps ring */}
      <Animated.View style={[styles.ringWrap, { opacity: progressAnim }]}>
        <Svg width={160} height={160} viewBox="0 0 160 160">
          <Defs>
            <LinearGradient id="stepGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={C.teal} />
              <Stop offset="1" stopColor={C.blue} />
            </LinearGradient>
          </Defs>
          {/* Track */}
          <Circle
            cx={80}
            cy={80}
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={12}
          />
          {/* Progress */}
          <Circle
            cx={80}
            cy={80}
            r={R}
            fill="none"
            stroke="url(#stepGrad)"
            strokeWidth={12}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            rotation="-90"
            origin="80,80"
          />
          {/* Shoe icon in center */}
          <Path
            d="M65 85 Q65 78 72 76 L88 76 Q95 78 95 85 L93 90 Q90 93 80 93 Q70 93 67 90 Z"
            fill={C.teal}
            opacity={0.8}
          />
          <Path
            d="M70 76 L70 72 Q72 68 80 68 Q88 68 90 72 L90 76"
            fill="none"
            stroke={C.teal}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>

      {/* Step count */}
      <Animated.View style={{ transform: [{ scale: pulseAnim }], marginTop: 12 }}>
        <AppText style={styles.stepCount}>{steps.toLocaleString()}</AppText>
        <AppText style={styles.stepGoal}>of {goal.toLocaleString()} steps</AppText>
      </Animated.View>

      {/* Weekly bar chart */}
      <AppView style={styles.barChart}>
        <AppText style={styles.sectionTitle}>THIS WEEK</AppText>
        <AppView style={styles.barsRow}>
          {BARS.map((bar, i) => (
            <AppView key={i} style={styles.barCol}>
              <AppView style={styles.barTrack}>
                <Animated.View
                  style={[
                    styles.barFill,
                    {
                      height: barEnter.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', `${bar.pct * 100}%`],
                      }),
                      backgroundColor: bar.pct >= 0.8 ? C.teal : C.blue,
                    },
                  ]}
                />
              </AppView>
              <AppText style={styles.barLabel}>{bar.day}</AppText>
            </AppView>
          ))}
        </AppView>
      </AppView>
    </AppView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ringWrap: { marginTop: -20 },
  stepCount: { color: '#fff', fontSize: 34, fontWeight: '900', textAlign: 'center' },
  stepGoal: { color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 2 },
  barChart: { width: width * 0.8, marginTop: 24 },
  sectionTitle: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  barsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  barCol: { alignItems: 'center', flex: 1 },
  barTrack: {
    width: 14,
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 7,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: { width: '100%', borderRadius: 7 },
  barLabel: { color: C.muted, fontSize: 10, fontWeight: '600', marginTop: 6 },
});
