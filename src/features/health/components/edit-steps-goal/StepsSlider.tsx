import React from 'react';
import { StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { AppText, AppView } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';

interface StepsSliderProps {
  value: number;
  onValueChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function StepsSlider({
  value,
  onValueChange,
  min = 1000,
  max = 20000,
  step = 500,
}: StepsSliderProps) {
  const { colors } = useTheme();
  return (
    <AppView style={styles.container}>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onValueChange}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.muted}
        thumbTintColor={colors.primary}
      />
      <AppView row spaceBetween style={styles.labels}>
        <AppText variant="caption2" secondary>{min.toLocaleString()}</AppText>
        <AppText variant="caption2" secondary>{max.toLocaleString()}</AppText>
      </AppView>
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 28,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  labels: {
    marginTop: -4,
  },
});
