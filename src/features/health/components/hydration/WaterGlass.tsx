// ─── WaterGlass Component ─────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { makeStyles } from '../../../../hooks/makeStyles';

interface WaterGlassProps {
  percentage: number;
  dailyGoal: number;
}

const useStyles = makeStyles(({ colors, spacing, radius, fontSize }) => ({
  container: {
    alignItems: 'center' as const,
    width: 120,
  },
  glass: {
    width: 90,
    height: 200,
    borderWidth: 2,
    borderColor: 'rgba(148,210,255,0.2)',
    borderRadius: radius.md,
    overflow: 'hidden' as const,
    backgroundColor: 'rgba(14,50,80,0.1)',
    zIndex: 1,
    position: 'relative' as const,
  },
  waterContainer: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden' as const,
  },
  wave: {
    height: 14,
    width: 200,
    backgroundColor: 'rgba(125,211,252,0.6)',
    borderRadius: 7,
    top: 0,
    left: -10,
    position: 'absolute' as const,
  },
  waterBody: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    top: 8,
    opacity: 0.85,
  },
  reflection: {
    position: 'absolute' as const,
    top: 10,
    left: 8,
    width: 8,
    height: '60%' as const,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.xs,
    zIndex: 2,
  },
  reflection2: {
    position: 'absolute' as const,
    top: 20,
    left: 20,
    width: 4,
    height: '35%' as const,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: spacing[0.5],
    zIndex: 2,
  },
  markLine: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    zIndex: 3,
  },
  markText: {
    fontSize: 8,
    marginLeft: spacing[1],
  },
  base: {
    width: 100,
    height: 8,
    borderRadius: radius.xs,
    marginTop: spacing[0.5],
  },
}));

export const WaterGlass: React.FC<WaterGlassProps> = ({
  percentage,
  dailyGoal,
}) => {
  const { colors } = useTheme();
  const styles = useStyles();

  const fillAnim = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fillAnim, {
      toValue: percentage,
      useNativeDriver: false,
      tension: 40,
      friction: 8,
    }).start();
  }, [percentage, fillAnim]);

  useEffect(() => {
    const wave = Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );

    wave.start();
    glow.start();

    return () => {
      wave.stop();
      glow.stop();
    };
  }, [glowAnim, waveAnim]);

  const fillHeight = fillAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const fillColor = fillAnim.interpolate({
    inputRange: [0, 50, 100],
    outputRange: [colors.primary, withOpacity(colors.primary, 0.8), withOpacity(colors.primary, 0.6)],
  });

  const waveTranslate = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  const MARKS = [25, 50, 75] as const;

  return (
    <View style={styles.container}>
      <View style={styles.glass}>
        <Animated.View style={[styles.waterContainer, { height: fillHeight }]}>
          <Animated.View
            style={[
              styles.wave,
              { transform: [{ translateX: waveTranslate }] },
            ]}
          />
          <Animated.View
            style={[styles.waterBody, { backgroundColor: fillColor }]}
          />
        </Animated.View>

        <View style={styles.reflection} />
        <View style={styles.reflection2} />

        {MARKS.map(mark => (
          <View
            key={mark}
            style={[styles.markLine, { bottom: `${mark}%` as any }]}
          >
            <AppText style={[styles.markText, { color: withOpacity(colors.primary, 0.5) }]}>{(dailyGoal * mark) / 100}ml</AppText>
          </View>
        ))}
      </View>

      <View style={[styles.base, { backgroundColor: withOpacity(colors.primary, 0.3) }]} />
    </View>
  );
};
