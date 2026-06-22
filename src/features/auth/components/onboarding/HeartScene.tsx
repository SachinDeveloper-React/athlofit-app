import React from 'react';
import { Animated } from 'react-native';
import { AppView, AppText } from '../../../../components';
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
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { BpRow } from './OnbaordingSubComponents';
import { wp, hp, SCREEN_WIDTH } from '../../../../utils/responsive';

export const HeartScene: React.FC = () => {
  const { colors, spacing, radius, fontSize, fontWeight } = useTheme();

  const heartScale = useHeartbeat();

  const ecgX = useLoopAnim({
    initialValue: 0,
    steps: [{ toValue: 1, duration: 1800 }],
  });
  const ecgTranslate = ecgX.interpolate({
    inputRange: [0, 1],
    outputRange: [0, wp(60)],
  });

  const ring1 = usePulseRing(1200, 0, 2.8);
  const ring2 = usePulseRing(1200, 600, 2.4);

  const sysAnim = useLoopAnim({
    initialValue: 0,
    useNativeDriver: false,
    steps: [
      { toValue: 1, duration: 2000 },
      { toValue: 0.4, duration: 1500 },
    ],
  });
  const sysWidth = sysAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [wp(8), wp(55)],
  });

  const diaAnim = useLoopAnim({
    initialValue: 0,
    useNativeDriver: false,
    steps: [
      { toValue: 1, duration: 1800 },
      { toValue: 0.5, duration: 1400 },
    ],
  });
  const diaWidth = diaAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [wp(6), wp(40)],
  });

  const bpItems: BpItem[] = [
    { label: 'SYS', val: '120', color: colors.destructive, animatedWidth: sysWidth },
    { label: 'DIA', val: '80', color: colors.primary, animatedWidth: diaWidth },
  ];

  const rings = [
    { scale: ring1.scale, opacity: ring1.opacity },
    { scale: ring2.scale, opacity: ring2.opacity },
  ];

  const heartSize = hp(12);
  const ecgH = hp(7);

  return (
    <AppView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[5] }}>
      {/* Pulse rings */}
      {rings.map(({ scale, opacity }, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            top: hp(6),
            alignSelf: 'center',
            width: spacing[20],
            height: spacing[20],
            borderRadius: spacing[10],
            borderWidth: 2,
            borderColor: colors.destructiveForeground,
            opacity,
            transform: [{ scale }],
          }}
        />
      ))}

      {/* Heart */}
      <Animated.View style={{ transform: [{ scale: heartScale }] }}>
        <Svg width={heartSize} height={heartSize * 0.92} viewBox="0 0 130 120">
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
          <Ellipse cx={47} cy={30} rx={12} ry={8} fill="rgba(255,255,255,0.25)" />
        </Svg>
      </Animated.View>

      {/* ECG strip */}
      <AppView style={{
        marginTop: spacing[3],
        width: wp(78),
        height: ecgH,
        backgroundColor: withOpacity(colors.success, 0.07),
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: withOpacity(colors.success, 0.25),
        overflow: 'hidden',
      }}>
        <Animated.View style={{ position: 'absolute', top: 0, left: -wp(60), transform: [{ translateX: ecgTranslate }] }}>
          <Svg width={SCREEN_WIDTH * 1.4} height={ecgH}>
            <Polyline
              points="0,35 30,35 40,10 50,58 60,20 70,35 90,35 100,35 110,10 120,58 130,20 140,35 160,35 170,35 180,10 190,58 200,20 210,35 230,35"
              fill="none"
              stroke={colors.success}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
        <AppText style={{
          position: 'absolute',
          bottom: spacing[1],
          right: spacing[2.5],
          color: colors.success,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.bold,
          letterSpacing: 1,
        }}>
          72 BPM
        </AppText>
      </AppView>

      {/* Blood Pressure */}
      <AppView style={{ marginTop: spacing[12], width: wp(78) }}>
        <AppText style={{
          color: colors.mutedForeground,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.bold,
          letterSpacing: 1.5,
          marginBottom: spacing[2],
        }}>
          BLOOD PRESSURE
        </AppText>
        {bpItems.map(item => (
          <BpRow key={item.label} item={item} />
        ))}
      </AppView>
    </AppView>
  );
};
