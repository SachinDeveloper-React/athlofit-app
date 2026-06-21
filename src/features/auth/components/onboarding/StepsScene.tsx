import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Path,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { AppView, AppText } from '../../../../components';
import { C } from '../../constant';
import { useLoopAnim, useEnterAnim } from '../../hooks';
import { s, vs, ms, wp, hp } from '../../../../utils/responsive';

export const StepsScene: React.FC = () => {
  const progressAnim = useLoopAnim({
    initialValue: 0.6,
    steps: [
      { toValue: 1, duration: 2000 },
      { toValue: 0.6, duration: 2000 },
    ],
  });

  const pulseAnim = useLoopAnim({
    initialValue: 1,
    steps: [
      { toValue: 1.05, duration: 800 },
      { toValue: 1, duration: 800 },
    ],
  });

  const barEnter = useEnterAnim({
    toValue: 1,
    duration: 1200,
    useNativeDriver: false,
  });

  const ringSize = hp(16);
  const R = ringSize * 0.375;
  const circ = 2 * Math.PI * R;
  const center = ringSize / 2;
  const steps = 8430;
  const goal = 10000;
  const pct = steps / goal;
  const dash = circ * pct;
  const strokeW = ringSize * 0.075;

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
      <Animated.View style={{ opacity: progressAnim }}>
        <Svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
          <Defs>
            <LinearGradient id="stepGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={C.teal} />
              <Stop offset="1" stopColor={C.blue} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={center}
            cy={center}
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={strokeW}
          />
          <Circle
            cx={center}
            cy={center}
            r={R}
            fill="none"
            stroke="url(#stepGrad)"
            strokeWidth={strokeW}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            rotation="-90"
            origin={`${center},${center}`}
          />
        </Svg>
      </Animated.View>

      {/* Step count */}
      <Animated.View style={[styles.countWrap, { transform: [{ scale: pulseAnim }] }]}>
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
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(20),
  },
  countWrap: { marginTop: vs(8) },
  stepCount: { color: '#fff', fontSize: ms(28), fontWeight: '900', textAlign: 'center' },
  stepGoal: { color: C.muted, fontSize: ms(11), textAlign: 'center', marginTop: vs(2) },
  barChart: { width: wp(78), marginTop: vs(14) },
  sectionTitle: {
    color: C.muted,
    fontSize: ms(10),
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: vs(8),
  },
  barsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  barCol: { alignItems: 'center', flex: 1 },
  barTrack: {
    width: s(12),
    height: hp(6),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: s(6),
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: { width: '100%', borderRadius: s(6) },
  barLabel: { color: C.muted, fontSize: ms(9), fontWeight: '600', marginTop: vs(4) },
});
