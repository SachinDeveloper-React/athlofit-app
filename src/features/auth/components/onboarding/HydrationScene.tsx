import React from 'react';
import { Animated, StyleSheet } from 'react-native';
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
import { useLoopAnim } from '../../hooks';
import { s, vs, ms, wp, hp } from '../../../../utils/responsive';

export const HydrationScene: React.FC = () => {
  const dropAnim = useLoopAnim({
    initialValue: 0,
    steps: [
      { toValue: 1, duration: 1000 },
      { toValue: 0, duration: 600 },
    ],
  });
  const dropTY = dropAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, vs(50)],
  });
  const dropO = dropAnim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 1, 0],
  });

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

  const bottleW = hp(8);
  const bottleH = hp(16);

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
            <Svg width={s(16)} height={vs(22)}>
              <Path
                d="M9 0 Q14 8 14 15 A5 5 0 0 1 4 15 Q4 8 9 0Z"
                fill={C.blue}
              />
            </Svg>
          </Animated.View>

          {/* Bottle */}
          <Svg width={bottleW} height={bottleH} viewBox="0 0 80 160">
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
            <Rect x={30} y={2} width={20} height={10} rx={4} fill="rgba(74,144,245,0.3)" />
            <G clipPath="url(#hydClip)">
              <Rect x={8} y={0} width={64} height={154} fill="url(#hydFill)" opacity={0.65} />
              <Path d="M8,60 Q22,50 36,60 Q50,70 64,60 Q72,56 72,56 L72,154 L8,154Z" fill="url(#hydFill)" />
            </G>
            {[40, 80, 120].map(y => (
              <Line key={y} x1={12} y1={y} x2={24} y2={y} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
            ))}
            <Rect x={16} y={45} width={6} height={60} rx={3} fill="rgba(255,255,255,0.12)" />
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
            <AppText style={[styles.intakeTime,{
              color: entry.color,
            }]}>{entry.time}</AppText>
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
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(20),
  },
  bottleRow: { flexDirection: 'row', alignItems: 'flex-end' },
  drop: { position: 'absolute', top: vs(-35), left: s(30) },
  ripple: {
    position: 'absolute',
    bottom: 0,
    left: s(16),
    width: s(34),
    height: s(34),
    borderRadius: s(17),
    borderWidth: 1.5,
    borderColor: C.blue,
  },
  hydrationInfo: { marginLeft: s(16), marginBottom: vs(16) },
  hydrationAmount: { fontSize: ms(28), fontWeight: '900' },
  hydrationGoal: { color: C.teal, fontSize: ms(11) },
  hydrationBadge: { marginTop: vs(6), flexDirection: 'row', alignItems: 'center' },
  hydrationDot: {
    width: s(7),
    height: s(7),
    borderRadius: s(4),
    backgroundColor: C.teal,
    marginRight: s(5),
  },
  hydrationPct: { color: C.teal, fontSize: ms(10), fontWeight: '700' },
  intakeSection: { width: wp(78), marginTop: vs(12) },
  sectionTitle: {
    color: C.blue,
    fontSize: ms(10),
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: vs(8),
  },
  intakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: vs(7),
  },
  intakeTime: {  fontSize: ms(9), fontWeight: '600', width: s(44) },
  intakeBar: {
    flex: 1,
    height: vs(6),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: s(3),
    marginHorizontal: s(8),
    overflow: 'hidden',
  },
  intakeFill: { height: '100%', borderRadius: s(3) },
  intakeAmount: { fontSize: ms(10), fontWeight: '700', width: s(44), textAlign: 'right' },
});
