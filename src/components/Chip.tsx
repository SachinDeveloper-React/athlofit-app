// src/components/Chip.tsx

import React from 'react';
import {
  TouchableOpacity,
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import AppText from './AppText';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius } from '../constants/spacing';

type ChipVariant = 'filled' | 'outlined' | 'soft';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  variant?: ChipVariant;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  disabled?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onPress,
  variant = 'soft',
  leftIcon,
  rightIcon,
  disabled = false,
  color,
  style,
}) => {
  const { colors } = useTheme();
  const accent = color ?? colors.primary;

  const getContainer = (): ViewStyle => {
    if (variant === 'filled')
      return {
        backgroundColor: selected ? accent : colors.secondary,
        borderWidth: 0,
      };
    if (variant === 'outlined')
      return {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: selected ? accent : colors.border,
      };
    return {
      backgroundColor: selected ? `${accent}15` : colors.secondary,
      borderWidth: 1,
      borderColor: selected ? `${accent}35` : 'transparent',
    };
  };

  const getLabelColor = () => {
    if (variant === 'filled')
      return selected ? colors.primaryForeground : colors.mutedForeground;
    return selected ? accent : colors.mutedForeground;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.72}
      style={[styles.base, getContainer(), disabled && styles.disabled, style]}
    >
      {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
      <AppText
        variant="label"
        color={getLabelColor()}
        weight={selected ? 'semiBold' : 'medium'}
      >
        {label}
      </AppText>
      {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1.5],
    borderRadius: Radius.full,
  },
  disabled: { opacity: 0.4 },
  iconLeft: { marginRight: Spacing[1] },
  iconRight: { marginLeft: Spacing[1] },
});

export default Chip;
