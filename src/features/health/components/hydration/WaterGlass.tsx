// ─── WaterGlass Component ─────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

interface WaterGlassProps {
  percentage: number;
  dailyGoal: number;
}

export const WaterGlass: React.FC<WaterGlassProps> = ({
  percentage,
  dailyGoal,
}) => {
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
    outputRange: ['#38bdf8', '#0ea5e9', '#0284c7'],
  });

  const waveTranslate = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  const MARKS = [25, 50, 75] as const;

  return (
    <View style={styles.container}>
      {/* Ambient glow */}

      {/* Glass body */}
      <View style={styles.glass}>
        {/* Water fill */}
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

        {/* Glass reflections */}
        <View style={styles.reflection} />
        <View style={styles.reflection2} />

        {/* Measurement marks */}
        {MARKS.map(mark => (
          <View
            key={mark}
            style={[styles.markLine, { bottom: `${mark}%` as any }]}
          >
            <Text style={styles.markText}>{(dailyGoal * mark) / 100}ml</Text>
          </View>
        ))}
      </View>

      {/* Glass base */}
      <View style={styles.base} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 120,
  },
  glow: {
    position: 'absolute',
    width: 110,
    height: 220,
    borderRadius: 55,
    backgroundColor: '#38bdf8',
    top: 10,
    zIndex: 0,
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  glass: {
    width: 90,
    height: 200,
    borderWidth: 2,
    borderColor: 'rgba(148,210,255,0.5)',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(14,50,80,0.3)',
    zIndex: 1,
    position: 'relative',
  },
  waterContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  wave: {
    height: 14,
    width: 200,
    backgroundColor: 'rgba(125,211,252,0.6)',
    borderRadius: 7,
    top: 0,
    left: -10,
    position: 'absolute',
  },
  waterBody: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 8,
    opacity: 0.85,
  },
  reflection: {
    position: 'absolute',
    top: 10,
    left: 8,
    width: 8,
    height: '60%',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 4,
    zIndex: 2,
  },
  reflection2: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 4,
    height: '35%',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 2,
    zIndex: 2,
  },
  markLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 3,
  },
  markText: {
    fontSize: 8,
    color: 'rgba(148,210,255,0.5)',
    marginLeft: 4,
  },
  base: {
    width: 100,
    height: 8,
    backgroundColor: 'rgba(56,189,248,0.3)',
    borderRadius: 4,
    marginTop: 2,
  },
});
