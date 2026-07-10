// ─── QuantityStepper.tsx ───────────────────────────────────────────────────────
// Compact quantity stepper with - / count / + buttons.
// Supports min/max bounds, haptic-style scaling animation on press.

import React, { memo, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { AppText } from '../../../../components';
import { Icon } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';

interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  accentColor?: string;
}

export const QuantityStepper = memo(({
  value,
  onChange,
  min = 1,
  max = 20,
  label,
  accentColor,
}: Props) => {
  const { colors } = useTheme();
  const accent = accentColor ?? colors.primary;

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pulse = useCallback(() => {
    scale.value = withSequence(
      withSpring(1.15, { damping: 6 }),
      withSpring(1, { damping: 8 }),
    );
  }, [scale]);

  const handleDecrement = useCallback(() => {
    if (value <= min) return;
    pulse();
    onChange(value - 1);
  }, [value, min, onChange, pulse]);

  const handleIncrement = useCallback(() => {
    if (value >= max) return;
    pulse();
    onChange(value + 1);
  }, [value, max, onChange, pulse]);

  const canDecrement = value > min;
  const canIncrement = value < max;

  return (
    <View style={styles.container}>
      {label && (
        <AppText variant="caption1" weight="semiBold" color={colors.mutedForeground}>
          {label}
        </AppText>
      )}
      <View style={[styles.stepper, { borderColor: withOpacity(accent, 0.2), backgroundColor: withOpacity(accent, 0.04) }]}>
        {/* Minus button */}
        <TouchableOpacity
          onPress={handleDecrement}
          disabled={!canDecrement}
          activeOpacity={0.6}
          style={[
            styles.btn,
            { backgroundColor: canDecrement ? withOpacity(accent, 0.12) : withOpacity(colors.mutedForeground, 0.06) },
          ]}
        >
          <Icon
            name="Minus"
            size={16}
            color={canDecrement ? accent : withOpacity(colors.mutedForeground, 0.3)}
          />
        </TouchableOpacity>

        {/* Count */}
        <Animated.View style={[styles.countWrap, animStyle]}>
          <AppText variant="title3" weight="bold" color={accent}>
            {value}
          </AppText>
        </Animated.View>

        {/* Plus button */}
        <TouchableOpacity
          onPress={handleIncrement}
          disabled={!canIncrement}
          activeOpacity={0.6}
          style={[
            styles.btn,
            { backgroundColor: canIncrement ? withOpacity(accent, 0.12) : withOpacity(colors.mutedForeground, 0.06) },
          ]}
        >
          <Icon
            name="Plus"
            size={16}
            color={canIncrement ? accent : withOpacity(colors.mutedForeground, 0.3)}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
});

QuantityStepper.displayName = 'QuantityStepper';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 12,
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countWrap: {
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
