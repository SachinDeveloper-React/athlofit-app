import React from 'react';
import { Animated, Dimensions, StyleSheet } from 'react-native';
import Svg, {
  Path,
  Rect,
  Line,
  Defs,
  LinearGradient,
  Stop,
  ClipPath,
  G,
} from 'react-native-svg';
import { AppView, AppText } from '../../../../components';
import { C } from '../../constant';
import { useLoopAnim, useEnterAnim } from '../../hooks';

const { width } = Dimensions.get('window');

export const HydrationScene: React.FC = () => {
  // Falling drop
  const dropAnim = useLoopAnim({
    initialValue: 0,
    steps: [
      { toValue: 1, duration: 1000 },
      { toValue: 0, duration: 600 },
    ],
  });
  const dropTY = dropAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 60],
  });
  const dropO = dropAnim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 1, 0],
  });

  // Ripple
  const ripple = useLoopAnim({
    initialValue: 0,
    steps: [
      { toValue: 1, duration: 1500 },
      { toValue: 0, duration: 0 },
    ],
  });
  const rippleS = ripple.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.2],
  });
  const rippleO = ripple.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.6, 0.3, 0],
  });

  // Wave animation
  const waveAnim = useLoopAnim({
    initialValue: 0,
    steps: [
      { toValue: 1, duration: 2500 },
      { toValue: 0, duration: 2500 },
    ],
  });

  return (
    <AppView style={styles.root}>
      {/* Water bottle + hydration */}
      <AppView style={styles.bottleRow}>
        <AppView>
          {/* Falling drop */}
          <Animated.View
            style={[
              styles.drop,
              { opacity: dropO, transform: [{ translateY: dropTY }] },
            ]}
          >
            <Svg width={18} height={26}>
              <Path
                d="M9 0 Q14 8 14 15 A5 5 0 0 1 4 15 Q4 8 9 0Z"
                fill={C.blue}
              />
            </Svg>
          </Animated.View>

          {/* Bottle */}
          <Svg width={80} height={160} viewBox="0 0 80 160">
            <Defs>
              <LinearGradient id="hydBg" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="rgba(74,144,245,0.15)" />
                <Stop offset="1" stopColor="rgba(74,144,245,0.05)" />
              </LinearGradient>
              <LinearGradient id="hydFill" x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor={C.blue} stopOpacity="0.9" />
                <Stop offset="1" stopColor={C.teal} stopOpacity="0.7" />
              </LinearGradient>
              <ClipPath id="hydClip">
                <Path d="M25 18 Q15 22 12 40 L8 140 Q8 154 40 154 Q72 154 72 140 L68 40 Q65 22 55 18 L50 10 L30 10 Z" />
              </ClipPath>
            </Defs>
            <Path
              d="M25 18 Q15 22 12 40 L8 140 Q8 154 40 154 Q72 154 72 140 L68 40 Q65 22 55 18 L50 10 L30 10 Z"
              fill="url(#hydBg)"
              stroke="rgba(74,144,245,0.4)"
              strokeWidth={1.5}
            />
            <Rect
              x={30}
              y={2}
              width={20}
              height={10}
              rx={4}
              fill="rgba(74,144,245,0.3)"
            />
            <G clipPath="url(#hydClip)">
              <Rect
                x={8}
                y={0}
                width={64}
                height={154}
                fill="url(#hydFill)"
                opacity={0.65}
              />
              <Path
                d="M8,60 Q22,50 36,60 Q50,70 64,60 Q72,56 72,56 L72,154 L8,154Z"
                fill="url(#hydFill)"
              />
            </G>
            {[40, 80, 120].map(y => (
              <Line
                key={y}
                x1={12}
                y1={y}
                x2={24}
                y2={y}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth={1}
              />
            ))}
            <Rect
              x={16}
              y={45}
              width={6}
              height={60}
              rx={3}
              fill="rgba(255,255,255,0.12)"
            />
          </Svg>

          {/* Ripple */}
          <Animated.View
            style={[
              styles.ripple,
              { opacity: rippleO, transform: [{ scale: rippleS }] },
            ]}
          />
        </AppView>

        {/* Hydration stats */}
        <AppView style={styles.hydrationInfo}>
          <AppText style={styles.hydrationAmount}>2.1L</AppText>
          <AppText style={styles.hydrationGoal}>of 3L goal</AppText>
          <AppView style={styles.hydrationBadge}>
            <AppView style={styles.hydrationDot} />
            <AppText style={styles.hydrationPct}>70% hydrated</AppText>
          </AppView>
        </AppView>
      </AppView>

      {/* Hourly intake */}
      <AppView style={styles.intakeSection}>
        <AppText style={styles.sectionTitle}>TODAY&apos;S INTAKE</AppText>
        {[
          { time: '8 AM', amount: '500ml', color: C.blue },
          { time: '11 AM', amount: '400ml', color: C.teal },
          { time: '2 PM', amount: '600ml', color: C.blue },
          { time: '5 PM', amount: '600ml', color: C.teal },
        ].map((entry, i) => (
          <AppView key={i} style={styles.intakeRow}>
            <AppText style={styles.intakeTime}>{entry.time}</AppText>
            <AppView style={styles.intakeBar}>
              <AppView
                style={[
                  styles.intakeFill,
                  {
                    width: `${(parseInt(entry.amount, 10) / 600) * 100}%`,
                    backgroundColor: entry.color,
                  },
                ]}
              />
            </AppView>
            <AppText style={[styles.intakeAmount, { color: entry.color }]}>
              {entry.amount}
            </AppText>
          </AppView>
        ))}
      </AppView>
    </AppView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottleRow: { flexDirection: 'row', alignItems: 'flex-end' },
  drop: { position: 'absolute', top: -40, left: 36 },
  ripple: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.blue,
  },
  hydrationInfo: { marginLeft: 20, marginBottom: 20 },
  hydrationAmount: { color: '#fff', fontSize: 32, fontWeight: '900' },
  hydrationGoal: { color: C.muted, fontSize: 13 },
  hydrationBadge: { marginTop: 8, flexDirection: 'row', alignItems: 'center' },
  hydrationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.teal,
    marginRight: 6,
  },
  hydrationPct: { color: C.teal, fontSize: 12, fontWeight: '700' },
  intakeSection: { width: width * 0.8, marginTop: 20 },
  sectionTitle: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  intakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  intakeTime: { color: C.muted, fontSize: 11, fontWeight: '600', width: 50 },
  intakeBar: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 4,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  intakeFill: { height: '100%', borderRadius: 4 },
  intakeAmount: { fontSize: 12, fontWeight: '700', width: 50, textAlign: 'right' },
});
