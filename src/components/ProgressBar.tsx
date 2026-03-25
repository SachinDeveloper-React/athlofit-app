// src/components/ProgressBar.tsx

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import AppText from './AppText';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius } from '../constants/spacing';

interface ProgressBarProps {
  value: number; // 0–100
  color?: string;
  trackColor?: string;
  height?: number;
  showLabel?: boolean;
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  color,
  trackColor,
  height = 8,
  showLabel = false,
  animated = true,
  style,
}) => {
  const { colors } = useTheme();
  const fillColor = color ?? colors.primary;
  const track = trackColor ?? colors.secondary;
  const clamped = Math.min(100, Math.max(0, value));
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(progress, {
        toValue: clamped,
        duration: 650,
        useNativeDriver: false,
      }).start();
    } else {
      progress.setValue(clamped);
    }
  }, [clamped]);

  const width = progress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={style}>
      {showLabel && (
        <AppText
          variant="caption1"
          align="right"
          style={{ marginBottom: Spacing[1] }}
        >
          {clamped}%
        </AppText>
      )}
      <View
        style={[
          styles.track,
          { backgroundColor: track, height, borderRadius: Radius.full },
        ]}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: fillColor,
              width,
              height,
              borderRadius: Radius.full,
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0 },
});

export default ProgressBar;
