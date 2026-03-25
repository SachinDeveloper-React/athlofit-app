// src/components/Input.tsx

import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  StyleProp,
  Animated,
  Platform,
} from 'react-native';
import AppText from './AppText';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize } from '../constants/typography';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InputProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isPassword?: boolean;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

// ─── Component ────────────────────────────────────────────────────────────────

const Input: React.FC<InputProps> = ({
  label,
  hint,
  error,
  leftIcon,
  rightIcon,
  isPassword = false,
  disabled = false,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...rest
}) => {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const handleFocus = (e: any) => {
    setFocused(true);
    Animated.timing(anim, {
      toValue: 1,
      duration: 160,
      useNativeDriver: false,
    }).start();
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setFocused(false);
    Animated.timing(anim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
    onBlur?.(e);
  };

  const borderColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      error ? colors.destructive : colors.border,
      error ? colors.destructive : colors.primary,
    ],
  });

  const borderWidth = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.5],
  });

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <AppText
          variant="label"
          style={{
            marginBottom: Spacing[1],
            color: error ? colors.destructive : colors.foreground,
          }}
        >
          {label}
        </AppText>
      )}

      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: disabled ? colors.muted : colors.inputBackground,
            borderColor,
            borderWidth,
            borderRadius: Radius.lg,
          },
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

        <TextInput
          style={[
            styles.input,
            {
              fontSize: FontSize.base,
              color: disabled ? colors.mutedForeground : colors.foreground,
            },
            leftIcon ? styles.inputWithLeft : undefined,
            rightIcon || isPassword ? styles.inputWithRight : undefined,
            style,
          ]}
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry={isPassword && !visible}
          editable={!disabled}
          onFocus={handleFocus}
          onBlur={handleBlur}
          selectionColor={colors.primary}
          {...rest}
        />

        {isPassword ? (
          <TouchableOpacity
            onPress={() => setVisible(v => !v)}
            style={styles.iconRight}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AppText variant="caption1" color={colors.mutedForeground}>
              {visible ? 'Hide' : 'Show'}
            </AppText>
          </TouchableOpacity>
        ) : rightIcon ? (
          <View style={styles.iconRight}>{rightIcon}</View>
        ) : null}
      </Animated.View>

      {(error || hint) && (
        <AppText
          variant="caption1"
          style={{
            marginTop: Spacing[1],
            color: error ? colors.destructive : colors.mutedForeground,
          }}
        >
          {error ?? hint}
        </AppText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginBottom: Spacing[4] },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: Spacing[4],
  },
  input: { flex: 1, paddingVertical: Spacing[3] },
  inputWithLeft: { marginLeft: Spacing[2] },
  inputWithRight: { marginRight: Spacing[2] },
  iconLeft: { marginRight: Spacing[1] },
  iconRight: { marginLeft: Spacing[1] },
});

export default Input;
