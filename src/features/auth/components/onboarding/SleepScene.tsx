import React from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { AppView, AppText } from '../../../../components';
import { Animated } from 'react-native';
import Svg, {
  Circle,
  Path,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { C } from '../../constant';
import { useLoopAnim, useEnterAnim } from '../../hooks';
import type { SleepStage } from '../../types';

const { width, height: screenHeight } = Dimensions.get('window');

const STAGES: SleepStage[] = [
  { label: 'REM', color: C.accent },
  { label: 'Light', color: C.blue },
  { label: 'Deep', color: C.teal },
];

const STAR_POSITIONS: [number, number][] = [
  [60, 30],
  [width - 70, 60],
  [90, 100],
  [width - 90, 20],
];

export const SleepScene: React.FC = () => {
  // Moon glow pulse
  const moonGlow = useLoopAnim({
    initialValue: 0.7,
    steps: [
      { toValue: 1, duration: 2000 },
      { toValue: 0.7, duration: 2000 },
    ],
  });

  // Star twinkles — different periods for organic feel
  const stars = [
    useLoopAnim({
      initialValue: 1,
      steps: [
        { toValue: 0.2, duration: 1400 },
        { toValue: 1, duration: 1400 },
      ],
    }),
    useLoopAnim({
      initialValue: 0.3,
      steps: [
        { toValue: 1, duration: 1800 },
        { toValue: 0.3, duration: 1800 },
      ],
    }),
    useLoopAnim({
      initialValue: 0.6,
      steps: [
        { toValue: 0.2, duration: 2200 },
        { toValue: 0.6, duration: 2200 },
      ],
    }),
    useLoopAnim({
      initialValue: 1,
      steps: [
        { toValue: 0.2, duration: 1600 },
        { toValue: 1, duration: 1600 },
      ],
    }),
  ];

  // Z float
  const zFloat = useLoopAnim({
    initialValue: 0,
    steps: [
      { toValue: -20, duration: 1800 },
      { toValue: 0, duration: 1800 },
    ],
  });

  // Wave scroll
  const waveAnim = useLoopAnim({
    initialValue: 0,
    steps: [{ toValue: 1, duration: 3000 }],
  });
  const waveTX = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -160],
  });

  // Sleep bar enter (JS thread — layout width)
  const sleepBar = useEnterAnim({
    toValue: 1,
    duration: 1500,
    useNativeDriver: false,
  });
  const sbWidth = sleepBar.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '78%'],
  });

  return (
    <AppView style={styles.root}>
      {/* Stars */}
      {STAR_POSITIONS.map(([left, top], i) => (
        <Animated.View
          key={i}
          style={[styles.star, { left, top, opacity: stars[i % stars.length] }]}
        >
          <Svg width={12} height={12}>
            <Circle cx={6} cy={6} r={2.5} fill={C.white} />
          </Svg>
        </Animated.View>
      ))}

      {/* Moon */}
      <Animated.View style={[styles.moonWrap, { opacity: moonGlow }]}>
        <Svg width={110} height={110} viewBox="0 0 110 110">
          <Defs>
            <LinearGradient id="mg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFD166" />
              <Stop offset="1" stopColor="#F4A261" />
            </LinearGradient>
          </Defs>
          <Circle cx={55} cy={55} r={38} fill="url(#mg)" />
          <Circle cx={72} cy={38} r={28} fill={C.bg1} />
          <Circle cx={32} cy={62} r={5} fill="rgba(0,0,0,0.15)" />
          <Circle cx={42} cy={78} r={3} fill="rgba(0,0,0,0.12)" />
        </Svg>
      </Animated.View>

      {/* Z Z Z */}
      <Animated.View
        style={{ transform: [{ translateY: zFloat }], marginTop: -10 }}
      >
        <AppText style={styles.zText}>z z z</AppText>
      </Animated.View>

      {/* Sleep wave */}
      <AppView style={styles.waveCard}>
        <Animated.View
          style={[styles.waveInner, { transform: [{ translateX: waveTX }] }]}
        >
          <Svg width={width * 2} height={60}>
            <Path
              d="M0,30 Q20,10 40,30 Q60,50 80,30 Q100,10 120,30 Q140,50 160,30 Q180,10 200,30 Q220,50 240,30 Q260,10 280,30 Q300,50 320,30 Q340,10 360,30 Q380,50 400,30 Q420,10 440,30 Q460,50 480,30 Q500,10 520,30 Q540,50 560,30 Q580,10 600,30 Q620,50 640,30 Q660,10 680,30 Q700,50 720,30"
              fill="none"
              stroke={C.blue}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>
        <AppText style={styles.deepLabel}>DEEP SLEEP</AppText>
      </AppView>

      {/* Sleep score */}
      <AppView style={styles.scoreSection}>
        <AppView style={styles.scoreHeader}>
          <AppText style={styles.scoreTitle}>SLEEP SCORE</AppText>
          <AppText style={styles.scoreDuration}>7h 42m</AppText>
        </AppView>
        <AppView style={styles.barTrack}>
          <Animated.View style={[styles.barFill, { width: sbWidth }]} />
        </AppView>
        <AppView style={styles.stagesRow}>
          {STAGES.map(s => (
            <AppView key={s.label} style={styles.stageItem}>
              <AppView style={[styles.stageDot, { backgroundColor: s.color }]} />
              <AppText style={styles.stageLabel}>{s.label}</AppText>
            </AppView>
          ))}
        </AppView>
      </AppView>
    </AppView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  star: { position: 'absolute' },
  moonWrap: { marginTop: -(screenHeight * 0.05) },

  zText: {
    color: C.gold,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 4,
    opacity: 0.9,
  },

  waveCard: {
    width: width * 0.8,
    height: 60,
    backgroundColor: 'rgba(74,144,245,0.08)',
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(74,144,245,0.2)',
  },
  waveInner: { position: 'absolute', top: 0, left: 0 },
  deepLabel: {
    position: 'absolute',
    bottom: 6,
    right: 12,
    color: C.blue,
    fontSize: 11,
    fontWeight: '700',
  },

  scoreSection: { marginTop: 20, width: width * 0.8 },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scoreTitle: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  scoreDuration: { color: C.gold, fontSize: 14, fontWeight: '800' },

  barTrack: {
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 5,
  },
  barFill: { height: 10, borderRadius: 5, backgroundColor: C.gold },

  stagesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  stageItem: { alignItems: 'center' },
  stageDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  stageLabel: { color: C.muted, fontSize: 11 },
});
