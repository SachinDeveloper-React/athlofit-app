// src/components/Card.tsx

import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius, Shadow } from '../constants/spacing';

type Variant = 'elevated' | 'outlined' | 'filled' | 'inset' | 'ghost';

interface CardProps {
  children: React.ReactNode;
  variant?: Variant;
  onPress?: () => void;
  p?: keyof typeof Spacing;
  radius?: keyof typeof Radius;
  bg?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  variant = 'elevated',
  onPress,
  p = 4,
  radius = '2xl',
  bg,
  style,
  disabled = false,
}) => {
  const { colors, isDark } = useTheme();

  const variantStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: bg ?? colors.card,
          ...(isDark ? {} : Shadow.sm),
        };
      case 'outlined':
        return {
          backgroundColor: bg ?? colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        };
      case 'filled':
        return { backgroundColor: bg ?? colors.secondary };
      case 'inset': // iOS settings-style inset grouped card
        return {
          backgroundColor: bg ?? colors.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          ...Shadow.xs,
        };
      case 'ghost':
        return { backgroundColor: 'transparent' };
    }
  };

  const composed: StyleProp<ViewStyle> = [
    styles.base,
    variantStyle(),
    { padding: Spacing[p], borderRadius: Radius[radius] },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.78}
        style={composed}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={composed}>{children}</View>;
};

const styles = StyleSheet.create({ base: { overflow: 'hidden' } });

export default Card;
