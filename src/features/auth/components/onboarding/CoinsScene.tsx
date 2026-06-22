import React from 'react';
import { Animated } from 'react-native';
import Svg, {
  Circle,
  Path,
  Ellipse,
  Defs,
  LinearGradient,
  Stop,
  ClipPath,
} from 'react-native-svg';
import { AppView, AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { useLoopAnim, useEnterAnim } from '../../hooks';
import { wp, hp } from '../../../../utils/responsive';

export const CoinsScene: React.FC = () => {
  const { colors, spacing, radius, fontSize, fontWeight } = useTheme();

  const floatAnim = useLoopAnim({
    initialValue: 0,
    steps: [
      { toValue: 1, duration: 2000 },
      { toValue: 0, duration: 2000 },
    ],
  });
  const floatY = floatAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -8, 0],
  });

  const glowAnim = useLoopAnim({
    initialValue: 0.5,
    steps: [
      { toValue: 1, duration: 1200 },
      { toValue: 0.5, duration: 1200 },
    ],
  });

  const counterScale = useEnterAnim({
    toValue: 1,
    duration: 800,
    useNativeDriver: true,
  });

  const coinSize = hp(14);

  return (
    <AppView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[5] }}>
      {/* Floating coin */}
      <Animated.View style={{ alignItems: 'center', transform: [{ translateY: floatY }] }}>
        <Animated.View style={{ width: coinSize, height: coinSize, opacity: glowAnim }}>
          <Svg width="100%" height="100%" viewBox="0 0 140 140">
          <Defs>
            <LinearGradient id="coinGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#FFF4A3" />
              <Stop offset="25%" stopColor="#FFD700" />
              <Stop offset="60%" stopColor="#F5A623" />
              <Stop offset="100%" stopColor="#FFD700" />
            </LinearGradient>

            <LinearGradient id="shineGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor="rgba(255,255,255,0)" />
              <Stop offset="50%" stopColor="rgba(255,255,255,0.6)" />
              <Stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </LinearGradient>

            <ClipPath id="coinClip">
              <Circle cx="70" cy="65" r="52" />
            </ClipPath>
          </Defs>

          {/* Shadow */}
          <Ellipse
            cx="70"
            cy="128"
            rx="35"
            ry="7"
            fill="rgba(0,0,0,0.25)"
          />

          {/* Outer Coin */}
          <Circle
            cx="70"
            cy="65"
            r="52"
            fill="url(#coinGrad)"
          />

          {/* Outer Ring */}
          <Circle
            cx="70"
            cy="65"
            r="48"
            fill="none"
            stroke="#FFE17A"
            strokeWidth="2"
          />

          {/* Inner Ring */}
          <Circle
            cx="70"
            cy="65"
            r="40"
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="2"
          />

          {/* Reflection Highlight */}
          <Ellipse
            cx="52"
            cy="42"
            rx="24"
            ry="12"
            fill="rgba(255,255,255,0.35)"
            transform="rotate(-25 52 42)"
          />

          {/* Bright Spot */}
          <Circle
            cx="45"
            cy="35"
            r="5"
            fill="rgba(255,255,255,0.65)"
          />

          {/* ₹ Symbol */}
          <Path
            d="
              M56 45
              H84
              M56 56
              H82
              M62 45
              C77 45 82 50 82 57
              C82 65 76 70 66 71
              L85 90
            "
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Shine Sweep */}
          {/* <AnimatedRect
            x={shineAnim}
            y={10}
            width={22}
            height={110}
            fill="url(#shineGrad)"
            clipPath="url(#coinClip)"
            transform="rotate(25 70 65)"
          /> */}
        </Svg>
        </Animated.View>
      </Animated.View>

      {/* Coin balance */}
      <Animated.View style={{ alignItems: 'center', marginTop: spacing[2], transform: [{ scale: counterScale }] }}>
        <AppText style={{
          color: colors.gold,
          fontSize: fontSize['5xl'],
          fontWeight: fontWeight.bold,
        }}>
          1,250
        </AppText>
        <AppText style={{
          color: colors.mutedForeground,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.semiBold,
          marginTop: spacing[0.5],
        }}>
          Coins Earned
        </AppText>
      </Animated.View>

      {/* Earn methods */}
      <AppView style={{ width: wp(78), marginTop: spacing[3] }}>
        <AppText style={{
          color: colors.mutedForeground,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.bold,
          letterSpacing: 1.5,
          marginBottom: spacing[2],
        }}>
          EARN BY
        </AppText>
        {[
          { icon: '👟', label: 'Walking & Running', coins: '+10/km' },
          { icon: '🎯', label: 'Completing Goals', coins: '+50' },
          { icon: '🔥', label: 'Daily Streak', coins: '+25' },
        ].map((item, i) => (
          <AppView
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: withOpacity(colors.foreground, 0.05),
              borderRadius: radius.lg,
              paddingVertical: spacing[2],
              paddingHorizontal: spacing[3],
              marginBottom: spacing[1.5],
              borderWidth: 1,
              borderColor: withOpacity(colors.gold, 0.15),
            }}
          >
            <AppText style={{ fontSize: fontSize.lg, marginRight: spacing[2.5] }}>
              {item.icon}
            </AppText>
            <AppView style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText style={{
                color: colors.foreground,
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semiBold,
              }}>
                {item.label}
              </AppText>
              <AppText style={{
                color: colors.gold,
                fontSize: fontSize.sm,
                fontWeight: fontWeight.bold,
              }}>
                {item.coins}
              </AppText>
            </AppView>
          </AppView>
        ))}
      </AppView>
    </AppView>
  );
};
