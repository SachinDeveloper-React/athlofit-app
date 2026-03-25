import React, { useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Animated } from 'react-native';
import Svg, {
  Path,
  Ellipse,
  Polyline,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { useHeartbeat, useLoopAnim, usePulseRing } from '../../hooks';
import { BpItem } from '../../types';
import { C } from '../../constant';
import { BpRow } from './OnbaordingSubComponents';

const { width } = Dimensions.get('window');

export const HeartScene: React.FC = () => {
  const heartScale = useHeartbeat();

  // ECG sweep
  const ecgX = useLoopAnim({
    initialValue: 0,
    steps: [{ toValue: 1, duration: 1800 }],
  });
  const ecgTranslate = ecgX.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width * 0.6],
  });

  // Pulse rings
  const ring1 = usePulseRing(1200, 0, 2.8);
  const ring2 = usePulseRing(1200, 600, 2.4);

  // BP bar (JS thread — animates layout width)
  const bpAnim = useLoopAnim({
    initialValue: 0,
    useNativeDriver: false,
    steps: [
      { toValue: 1, duration: 2000 },
      { toValue: 0.6, duration: 1500 },
    ],
  });
  const bpWidth = bpAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [30, 140],
  });

  const bpItems: BpItem[] = [
    { label: 'SYS', val: '120', color: C.accent, animatedWidth: bpWidth },
    { label: 'DIA', val: '80', color: C.blue, animatedWidth: 100 as any },
  ];

  const rings = [
    { scale: ring1.scale, opacity: ring1.opacity },
    { scale: ring2.scale, opacity: ring2.opacity },
  ];

  return (
    <View style={styles.root}>
      {/* Pulse rings */}
      {rings.map(({ scale, opacity }, i) => (
        <Animated.View
          key={i}
          style={[styles.pulseRing, { opacity, transform: [{ scale }] }]}
        />
      ))}

      {/* Heart */}
      <Animated.View
        style={{ transform: [{ scale: heartScale }], marginTop: -height(8) }}
      >
        <Svg width={130} height={120} viewBox="0 0 130 120">
          <Defs>
            <LinearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FF6B9D" />
              <Stop offset="1" stopColor="#FF1744" />
            </LinearGradient>
          </Defs>
          <Path
            d="M65 105 C30 80 5 60 5 35 C5 18 18 5 35 5 C47 5 58 12 65 22 C72 12 83 5 95 5 C112 5 125 18 125 35 C125 60 100 80 65 105Z"
            fill="url(#hg)"
          />
          <Ellipse
            cx={47}
            cy={30}
            rx={12}
            ry={8}
            fill="rgba(255,255,255,0.25)"
          />
        </Svg>
      </Animated.View>

      {/* ECG strip */}
      <View style={styles.ecgStrip}>
        <Animated.View
          style={[
            styles.ecgInner,
            { transform: [{ translateX: ecgTranslate }] },
          ]}
        >
          <Svg width={width * 1.4} height={70}>
            <Polyline
              points="0,35 30,35 40,10 50,58 60,20 70,35 90,35 100,35 110,10 120,58 130,20 140,35 160,35 170,35 180,10 190,58 200,20 210,35 230,35"
              fill="none"
              stroke={C.teal}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
        <Text style={styles.bpmLabel}>72 BPM</Text>
      </View>

      {/* Blood Pressure */}
      <View style={styles.bpSection}>
        <Text style={styles.sectionTitle}>BLOOD PRESSURE</Text>
        {bpItems.map(item => (
          <BpRow key={item.label} item={item} />
        ))}
      </View>
    </View>
  );
};

// Dimensions helper for percentage-based layout
const { height: screenHeight } = Dimensions.get('window');
const height = (pct: number) => (screenHeight * pct) / 100;

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  pulseRing: {
    position: 'absolute',
    top: screenHeight * 0.08,
    alignSelf: 'center',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: C.accent,
  },

  ecgStrip: {
    marginTop: 20,
    width: width * 0.8,
    height: 70,
    backgroundColor: 'rgba(0,229,195,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,229,195,0.25)',
    overflow: 'hidden',
  },
  ecgInner: {
    position: 'absolute',
    top: 0,
    left: -(width * 0.6),
  },
  bpmLabel: {
    position: 'absolute',
    bottom: 6,
    right: 12,
    color: C.teal,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },

  bpSection: { marginTop: 20, width: width * 0.8 },
  sectionTitle: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
});
