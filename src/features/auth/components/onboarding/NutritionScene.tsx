import React from 'react';
import { Dimensions } from 'react-native';
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
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { useEnterAnim, useLoopAnim, useStaggeredEnter } from '../../hooks';
import { MacroRow } from './OnbaordingSubComponents';

const { width } = Dimensions.get('window');

export const NutritionScene: React.FC = () => {
  const { colors, spacing, radius, fontSize, fontWeight } = useTheme();

  const MACROS: MacroItem[] = [
    { label: 'Carbs', pct: 0.55, color: colors.gold, val: '220g' },
    { label: 'Protein', pct: 0.72, color: colors.success, val: '145g' },
    { label: 'Fat', pct: 0.4, color: colors.destructiveForeground, val: '62g' },
  ];

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
    <AppView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      {/* Water bottle + hydration */}
      <AppView style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <AppView>
          {/* Falling drop */}
          <Animated.View
            style={{
              position: 'absolute',
              top: -spacing[10],
              left: spacing[8] + spacing[1],
              opacity: dropO,
              transform: [{ translateY: dropTY }],
            }}
          >
            <Svg width={18} height={26}>
              <Path
                d="M9 0 Q14 8 14 15 A5 5 0 0 1 4 15 Q4 8 9 0Z"
                fill={colors.primary}
              />
            </Svg>
          </Animated.View>

          {/* Bottle */}
          <Svg width={80} height={160} viewBox="0 0 80 160">
            <Defs>
              <LinearGradient id="botbg" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={withOpacity(colors.primary, 0.15)} />
                <Stop offset="1" stopColor={withOpacity(colors.primary, 0.05)} />
              </LinearGradient>
              <LinearGradient id="wfill" x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor={colors.primary} stopOpacity="0.9" />
                <Stop offset="1" stopColor={colors.success} stopOpacity="0.7" />
              </LinearGradient>
              <ClipPath id="bottleClip">
                <Path d="M25 18 Q15 22 12 40 L8 140 Q8 154 40 154 Q72 154 72 140 L68 40 Q65 22 55 18 L50 10 L30 10 Z" />
              </ClipPath>
            </Defs>
            <Path
              d="M25 18 Q15 22 12 40 L8 140 Q8 154 40 154 Q72 154 72 140 L68 40 Q65 22 55 18 L50 10 L30 10 Z"
              fill="url(#botbg)"
              stroke={withOpacity(colors.primary, 0.4)}
              strokeWidth={1.5}
            />
            <Rect
              x={30}
              y={2}
              width={20}
              height={10}
              rx={4}
              fill={withOpacity(colors.primary, 0.3)}
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
            style={{
              position: 'absolute',
              bottom: 0,
              left: spacing[5],
              width: spacing[10],
              height: spacing[10],
              borderRadius: spacing[5],
              borderWidth: 1.5,
              borderColor: colors.primary,
              opacity: rippleO,
              transform: [{ scale: rippleS }],
            }}
          />
        </AppView>

        {/* Hydration stats */}
        <AppView style={{ marginLeft: spacing[5], marginBottom: spacing[5] }}>
          <AppText style={{
            color: colors.foreground,
            fontSize: fontSize['5xl'],
            fontWeight: fontWeight.bold,
          }}>
            2.1L
          </AppText>
          <AppText style={{
            color: colors.mutedForeground,
            fontSize: fontSize.md,
          }}>
            of 3L goal
          </AppText>
          <AppView style={{ marginTop: spacing[2], flexDirection: 'row', alignItems: 'center' }}>
            <AppView style={{
              width: spacing[2],
              height: spacing[2],
              borderRadius: radius.xs,
              backgroundColor: colors.success,
              marginRight: spacing[1.5],
            }} />
            <AppText style={{
              color: colors.success,
              fontSize: fontSize.sm,
              fontWeight: fontWeight.bold,
            }}>
              70% hydrated
            </AppText>
          </AppView>
        </AppView>
      </AppView>

      {/* Macro bars */}
      <AppView style={{ width: width * 0.8, marginTop: spacing[4] }}>
        <AppText style={{
          color: colors.mutedForeground,
          fontSize: fontSize.md,
          fontWeight: fontWeight.semiBold,
          letterSpacing: 1.5,
          marginBottom: spacing[3],
        }}>
          MACROS TODAY
        </AppText>
        {MACROS.map((m, i) => (
          <MacroRow key={m.label} macro={m} widthAnim={barAnims[i]} />
        ))}
      </AppView>
    </AppView>
  );
};
