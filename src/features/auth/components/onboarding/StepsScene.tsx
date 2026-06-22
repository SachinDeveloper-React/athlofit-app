import React from 'react';
import { Animated } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { AppView, AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { useLoopAnim, useEnterAnim } from '../../hooks';
import { wp, hp } from '../../../../utils/responsive';

export const StepsScene: React.FC = () => {
  const { colors, spacing, radius, fontSize, fontWeight } = useTheme();

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
    <AppView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[5] }}>
      {/* Steps ring */}
      <Animated.View style={{ opacity: progressAnim }}>
        <Svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
          <Defs>
            <LinearGradient id="stepGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.success} />
              <Stop offset="1" stopColor={colors.primary} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={center}
            cy={center}
            r={R}
            fill="none"
            stroke={withOpacity(colors.foreground, 0.07)}
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
      <Animated.View style={{ marginTop: spacing[2], transform: [{ scale: pulseAnim }] }}>
        <AppText style={{
          fontSize: fontSize['4xl'],
          fontWeight: fontWeight.bold,
          textAlign: 'center',
          color: colors.foreground,
        }}>
          {steps.toLocaleString()}
        </AppText>
        <AppText style={{
          fontSize: fontSize.xs,
          fontWeight: fontWeight.semiBold,
          textAlign: 'center',
          marginTop: spacing[0.5],
          color: colors.success,
        }}>
          of {goal.toLocaleString()} steps
        </AppText>
      </Animated.View>

      {/* Weekly bar chart */}
      <AppView style={{ width: wp(78), marginTop: spacing[4] }}>
        <AppText style={{
          color: colors.primary,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.bold,
          letterSpacing: 1.5,
          marginBottom: spacing[2],
        }}>
          THIS WEEK
        </AppText>
        <AppView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          {BARS.map((bar, i) => (
            <AppView key={i} style={{ alignItems: 'center', flex: 1 }}>
              <AppView style={{
                width: spacing[3],
                height: hp(6),
                backgroundColor: withOpacity(colors.foreground, 0.06),
                borderRadius: radius.sm,
                overflow: 'hidden',
                justifyContent: 'flex-end',
              }}>
                <Animated.View
                  style={{
                    width: '100%',
                    borderRadius: radius.sm,
                    height: barEnter.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', `${bar.pct * 100}%`],
                    }),
                    backgroundColor: bar.pct >= 0.8 ? colors.success : colors.primary,
                  }}
                />
              </AppView>
              <AppText style={{
                color: colors.mutedForeground,
                fontSize: fontSize.xs,
                fontWeight: fontWeight.semiBold,
                marginTop: spacing[1],
              }}>
                {bar.day}
              </AppText>
            </AppView>
          ))}
        </AppView>
      </AppView>
    </AppView>
  );
};
