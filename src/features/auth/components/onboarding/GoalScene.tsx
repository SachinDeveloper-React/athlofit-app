import React from 'react';
import { Animated, Dimensions, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { AppView, AppText } from '../../../../components';
import { GoalItem } from '../../types';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { useLoopAnim } from '../../hooks';
import { GoalRing } from './OnbaordingSubComponents';

const { width, height: screenHeight } = Dimensions.get('window');

export const GoalScene: React.FC = () => {
  const { colors, spacing, radius, fontSize, fontWeight } = useTheme();

  const GOALS: GoalItem[] = [
    {
      label: 'Steps',
      target: '10,000',
      curr: '8,430',
      pct: 0.843,
      color: colors.success,
    },
    {
      label: 'Calories',
      target: '2,200',
      curr: '1,740',
      pct: 0.79,
      color: colors.destructiveForeground,
    },
    {
      label: 'Active',
      target: '60 min',
      curr: '47 min',
      pct: 0.78,
      color: colors.gold,
    },
  ];

  const glowAnim = useLoopAnim({
    initialValue: 0.6,
    steps: [
      { toValue: 1, duration: 1500 },
      { toValue: 0.6, duration: 1500 },
    ],
  });

  const bigR = 64;
  const circ = 2 * Math.PI * bigR;
  const score = 87;
  const dash = circ * 0.87;

  return (
    <AppView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      {/* Main score ring */}
      <Animated.View style={{ marginTop: -(screenHeight * 0.06), opacity: glowAnim }}>
        <Svg width={160} height={160} viewBox="0 0 160 160">
          <Defs>
            <LinearGradient id="rg1" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.success} />
              <Stop offset="1" stopColor={colors.primary} />
            </LinearGradient>
          </Defs>
          {/* Track */}
          <Circle
            cx={80}
            cy={80}
            r={bigR}
            fill="none"
            stroke={withOpacity(colors.foreground, 0.07)}
            strokeWidth={14}
          />
          {/* Progress */}
          <Circle
            cx={80}
            cy={80}
            r={bigR}
            fill="none"
            stroke="url(#rg1)"
            strokeWidth={14}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            rotation="-90"
            origin="80,80"
          />
          <Circle cx={80} cy={80} r={48} fill={withOpacity(colors.success, 0.05)} />
        </Svg>

        {/* Score overlay */}
        <AppView style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}>
          <AppText style={{
            color: colors.foreground,
            fontSize: fontSize['5xl'],
            fontWeight: fontWeight.bold,
          }}>
            {score}
          </AppText>
          <AppText style={{
            color: colors.success,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.bold,
            letterSpacing: 2,
          }}>
            SCORE
          </AppText>
        </AppView>
      </Animated.View>

      {/* Goal rings row */}
      <AppView style={{
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: width * 0.85,
        marginTop: spacing[4],
      }}>
        {GOALS.map(g => (
          <GoalRing key={g.label} goal={g} />
        ))}
      </AppView>

      {/* CTA */}
      <AppView style={{ marginTop: spacing[5], alignItems: 'center' }}>
        <AppText style={{
          color: colors.foreground,
          fontSize: fontSize.lg,
          fontWeight: fontWeight.bold,
          letterSpacing: 0.5,
        }}>
          You're almost there! 🔥
        </AppText>
        <AppText style={{
          color: colors.mutedForeground,
          fontSize: fontSize.md,
          marginTop: spacing[1],
          textAlign: 'center',
        }}>
          Keep moving to hit today's goals
        </AppText>
      </AppView>
    </AppView>
  );
};
