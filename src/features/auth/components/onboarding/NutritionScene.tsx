import React from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { AppView, AppText } from '../../../../components';
import { Animated } from 'react-native';
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
import { MacroItem } from '../../types';
import { C } from '../../constant';
import { useEnterAnim, useLoopAnim, useStaggeredEnter } from '../../hooks';
import { MacroRow } from './OnbaordingSubComponents';

const { width } = Dimensions.get('window');

const MACROS: MacroItem[] = [
  { label: 'Carbs', pct: 0.55, color: C.gold, val: '220g' },
  { label: 'Protein', pct: 0.72, color: C.teal, val: '145g' },
  { label: 'Fat', pct: 0.4, color: C.accent, val: '62g' },
];

export const NutritionScene: React.FC = () => {
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

  // Bottle fill (JS thread)
  const fillAnim = useEnterAnim({
    toValue: 1,
    duration: 2000,
    useNativeDriver: false,
  });
  const fillH = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '65%'],
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

  // Macro bar enter anims (staggered)
  const barAnims = useStaggeredEnter(MACROS.length, 1200, 200, false);

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
              <LinearGradient id="botbg" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="rgba(74,144,245,0.15)" />
                <Stop offset="1" stopColor="rgba(74,144,245,0.05)" />
              </LinearGradient>
              <LinearGradient id="wfill" x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor={C.blue} stopOpacity="0.9" />
                <Stop offset="1" stopColor={C.teal} stopOpacity="0.7" />
              </LinearGradient>
              <ClipPath id="bottleClip">
                <Path d="M25 18 Q15 22 12 40 L8 140 Q8 154 40 154 Q72 154 72 140 L68 40 Q65 22 55 18 L50 10 L30 10 Z" />
              </ClipPath>
            </Defs>
            <Path
              d="M25 18 Q15 22 12 40 L8 140 Q8 154 40 154 Q72 154 72 140 L68 40 Q65 22 55 18 L50 10 L30 10 Z"
              fill="url(#botbg)"
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
            <G clipPath="url(#bottleClip)">
              <Rect
                x={8}
                y={0}
                width={64}
                height={154}
                fill="url(#wfill)"
                opacity={0.65}
              />
              <Path
                d="M8,60 Q22,50 36,60 Q50,70 64,60 Q72,56 72,56 L72,154 L8,154Z"
                fill="url(#wfill)"
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

      {/* Macro bars */}
      <AppView style={styles.macroSection}>
        <AppText style={styles.sectionTitle}>MACROS TODAY</AppText>
        {MACROS.map((m, i) => (
          <MacroRow key={m.label} macro={m} widthAnim={barAnims[i]} />
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
  hydrationGoal: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  hydrationBadge: { marginTop: 8, flexDirection: 'row', alignItems: 'center' },
  hydrationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E5C3',
    marginRight: 6,
  },
  hydrationPct: { color: '#00E5C3', fontSize: 12, fontWeight: '700' },

  macroSection: { width: width * 0.8, marginTop: 16 },
  sectionTitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
});
