import React from 'react';
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
import { AppView, AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { useLoopAnim } from '../../hooks';
import { wp, hp } from '../../../../utils/responsive';

export const HydrationScene: React.FC = () => {
  const { colors, spacing, radius, fontSize, fontWeight } = useTheme();

  const dropAnim = useLoopAnim({
    initialValue: 0,
    steps: [
      { toValue: 1, duration: 1000 },
      { toValue: 0, duration: 600 },
    ],
  });
  const dropTY = dropAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, spacing[12]],
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
    <AppView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[5] }}>
      {/* Water bottle + hydration */}
      <AppView style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <AppView>
          {/* Falling drop */}
          <Animated.View
            style={{
              position: 'absolute',
              top: -spacing[8],
              left: spacing[7],
              opacity: dropO,
              transform: [{ translateY: dropTY }],
            }}
          >
            <Svg width={spacing[4]} height={spacing[5]}>
              <Path
                d="M9 0 Q14 8 14 15 A5 5 0 0 1 4 15 Q4 8 9 0Z"
                fill={colors.primary}
              />
            </Svg>
          </Animated.View>

          {/* Bottle */}
          <Svg width={bottleW} height={bottleH} viewBox="0 0 80 160">
            <Defs>
              <LinearGradient id="hydBg" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={withOpacity(colors.primary, 0.15)} />
                <Stop offset="1" stopColor={withOpacity(colors.primary, 0.05)} />
              </LinearGradient>
              <LinearGradient id="hydFill" x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor={colors.primary} stopOpacity="0.9" />
                <Stop offset="1" stopColor={colors.success} stopOpacity="0.7" />
              </LinearGradient>
              <ClipPath id="hydClip">
                <Path d="M25 18 Q15 22 12 40 L8 140 Q8 154 40 154 Q72 154 72 140 L68 40 Q65 22 55 18 L50 10 L30 10 Z" />
              </ClipPath>
            </Defs>
            <Path
              d="M25 18 Q15 22 12 40 L8 140 Q8 154 40 154 Q72 154 72 140 L68 40 Q65 22 55 18 L50 10 L30 10 Z"
              fill="url(#hydBg)"
              stroke={withOpacity(colors.primary, 0.4)}
              strokeWidth={1.5}
            />
            <Rect x={30} y={2} width={20} height={10} rx={4} fill={withOpacity(colors.primary, 0.3)} />
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
            style={{
              position: 'absolute',
              bottom: 0,
              left: spacing[4],
              width: spacing[8],
              height: spacing[8],
              borderRadius: spacing[4],
              borderWidth: 1.5,
              borderColor: colors.primary,
              opacity: rippleO,
              transform: [{ scale: rippleS }],
            }}
          />
        </AppView>

        {/* Hydration stats */}
        <AppView style={{ marginLeft: spacing[4], marginBottom: spacing[4] }}>
          <AppText style={{
            color: colors.foreground,
            fontSize: fontSize['4xl'],
            fontWeight: fontWeight.bold,
          }}>
            2.1L
          </AppText>
          <AppText style={{
            color: colors.success,
            fontSize: fontSize.xs,
            fontWeight: fontWeight.medium,
          }}>
            of 3L goal
          </AppText>
          <AppView style={{ marginTop: spacing[1.5], flexDirection: 'row', alignItems: 'center' }}>
            <AppView style={{
              width: spacing[2],
              height: spacing[2],
              borderRadius: radius.xs,
              backgroundColor: colors.success,
              marginRight: spacing[1.25],
            }} />
            <AppText style={{
              color: colors.success,
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
            }}>
              70% hydrated
            </AppText>
          </AppView>
        </AppView>
      </AppView>

      {/* Hourly intake */}
      <AppView style={{ width: wp(78), marginTop: spacing[3] }}>
        <AppText style={{
          color: colors.primary,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.bold,
          letterSpacing: 1.5,
          marginBottom: spacing[2],
        }}>
          TODAY&apos;S INTAKE
        </AppText>
        {[
          { time: '8 AM', amount: '500ml', color: colors.primary },
          { time: '11 AM', amount: '400ml', color: colors.success },
          { time: '2 PM', amount: '600ml', color: colors.primary },
          { time: '5 PM', amount: '600ml', color: colors.success },
        ].map((entry, i) => (
          <AppView key={i} style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: spacing[2],
          }}>
            <AppText style={{
              color: entry.color,
              fontSize: fontSize.xs,
              fontWeight: fontWeight.semiBold,
              width: spacing[10],
            }}>
              {entry.time}
            </AppText>
            <AppView style={{
              flex: 1,
              height: spacing[1.5],
              backgroundColor: withOpacity(colors.foreground, 0.06),
              borderRadius: radius.xs,
              marginHorizontal: spacing[2],
              overflow: 'hidden',
            }}>
              <AppView
                style={{
                  height: '100%',
                  borderRadius: radius.xs,
                  width: `${(parseInt(entry.amount, 10) / 600) * 100}%`,
                  backgroundColor: entry.color,
                }}
              />
            </AppView>
            <AppText style={{
              color: entry.color,
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
              width: spacing[10],
              textAlign: 'right',
            }}>
              {entry.amount}
            </AppText>
          </AppView>
        ))}
      </AppView>
    </AppView>
  );
};
