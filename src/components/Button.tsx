// src/components/Button.tsx

import React from 'react';
import {
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  View,
  Platform,
} from 'react-native';
// import * as Haptics from 'expo-haptics'; // remove if not using Expo; call Vibration.vibrate() instead
import AppText from './AppText';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';

// ─── Types ────────────────────────────────────────────────────────────────────

type Variant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'tinted';
type Size = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

// ─── Size config ──────────────────────────────────────────────────────────────

const sizeConfig: Record<
  Size,
  { height: number; px: number; radius: number; fontSize: number }
> = {
  sm: { height: 34, px: Spacing[3], radius: Radius.md, fontSize: FontSize.sm },
  md: { height: 44, px: Spacing[5], radius: Radius.lg, fontSize: FontSize.md },
  lg: {
    height: 50,
    px: Spacing[6],
    radius: Radius.xl,
    fontSize: FontSize.base,
  },
  xl: { height: 56, px: Spacing[6], radius: Radius.xl, fontSize: FontSize.lg },
};

// ─── Component ────────────────────────────────────────────────────────────────

const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  haptic = true,
  style,
  labelStyle,
}) => {
  const { colors } = useTheme();
  const sc = sizeConfig[size];
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (haptic && Platform.OS === 'ios') {
      //   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  // ── Variant-specific styles ──────────────────────────────────────────────
  const containerStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return { backgroundColor: colors.primary };
      case 'secondary':
        return { backgroundColor: colors.secondary };
      case 'tinted':
        return { backgroundColor: `${colors.primary}18` };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.primary,
        };
      case 'ghost':
        return { backgroundColor: 'transparent' };
      case 'destructive':
        return { backgroundColor: colors.destructive };
    }
  };

  const labelColor = (): string => {
    switch (variant) {
      case 'primary':
        return colors.primaryForeground;
      case 'secondary':
        return colors.secondaryForeground;
      case 'tinted':
        return colors.primary;
      case 'outline':
        return colors.primary;
      case 'ghost':
        return colors.primary;
      case 'destructive':
        return colors.destructiveForeground;
    }
  };

  const loaderColor = labelColor();

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.72}
      style={[
        styles.base,
        containerStyle(),
        {
          height: sc.height,
          paddingHorizontal: sc.px,
          borderRadius: sc.radius,
        },
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={loaderColor} />
      ) : (
        <>
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          <AppText
            variant="label"
            style={[
              {
                fontSize: sc.fontSize,
                fontWeight: FontWeight.semiBold,
                color: labelColor(),
              },
              labelStyle,
            ]}
          >
            {label}
          </AppText>
          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.4 },
  iconLeft: { marginRight: Spacing[2] },
  iconRight: { marginLeft: Spacing[2] },
});

export default Button;
