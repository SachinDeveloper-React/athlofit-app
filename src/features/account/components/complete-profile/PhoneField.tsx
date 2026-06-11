/**
 * PhoneField.tsx
 *
 * Phone input with a fixed country-code prefix badge (+91).
 * The form value is stored as the full E.164 string: "+91XXXXXXXXXX"
 * The input only shows/edits the local number part (10 digits for India).
 *
 * Usage:
 *   <PhoneField
 *     value={value}          // full value e.g. "+919876543210"
 *     onChangeText={onChange}
 *     onBlur={onBlur}
 *     error={errors.phone?.message}
 *     isVerified={user?.phoneVerified}
 *   />
 */

import React, { useRef, useState } from 'react';
import { Animated, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { AppView, AppText } from '../../../../components';
import { Icon } from '../../../../components';

const COUNTRY_CODE = '+91';
const COUNTRY_FLAG = '🇮🇳';

interface PhoneFieldProps {
  value: string;           // full value stored in form: "+91XXXXXXXXXX"
  onChangeText: (v: string) => void;
  onBlur: () => void;
  error?: string;
  isVerified?: boolean;
  label?: string;
  onVerifyPress?: () => void;
}

export const PhoneField: React.FC<PhoneFieldProps> = ({
  value,
  onChangeText,
  onBlur,
  error,
  isVerified,
  label = 'Phone Number',
  onVerifyPress,
}) => {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  // Strip the country code prefix to get the local digits for display
  const localNumber = value.startsWith(COUNTRY_CODE)
    ? value.slice(COUNTRY_CODE.length)
    : value.startsWith('+') // some other country code — show raw
    ? value
    : value;

  const handleChange = (text: string) => {
    // Only allow digits, max 10 for India
    const digits = text.replace(/\D/g, '').slice(0, 10);
    onChangeText(digits.length > 0 ? `${COUNTRY_CODE}${digits}` : '');
  };

  const onFocus = () => {
    setFocused(true);
    Animated.timing(anim, { toValue: 1, duration: 150, useNativeDriver: false }).start();
  };

  const onBlurField = () => {
    setFocused(false);
    Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: false }).start();
    onBlur();
  };

  const borderColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      error ? colors.destructive : colors.border,
      error ? colors.destructive : colors.primary,
    ],
  });

  return (
    <AppView style={styles.wrapper}>
      <AppText
        style={[styles.label, { color: error ? colors.destructive : colors.foreground }]}
      >
        {label}
      </AppText>

      <Animated.View
        style={[
          styles.box,
          {
            backgroundColor: colors.inputBackground,
            borderColor,
            borderWidth: focused ? 1.5 : 1,
          },
        ]}
      >
        {/* Country code badge — tapping focuses the input */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => inputRef.current?.focus()}
          style={[styles.prefix, { borderRightColor: colors.border }]}
        >
          <AppText style={styles.flag}>{COUNTRY_FLAG}</AppText>
          <AppText
            variant="body"
            weight="semiBold"
            style={{ color: colors.foreground }}
          >
            {COUNTRY_CODE}
          </AppText>
        </TouchableOpacity>

        {/* Local number input */}
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.foreground }]}
          placeholder="98765 43210"
          placeholderTextColor={colors.mutedForeground}
          value={localNumber.startsWith('+') ? localNumber : localNumber}
          onChangeText={handleChange}
          onFocus={onFocus}
          onBlur={onBlurField}
          keyboardType="phone-pad"
          maxLength={10}
          returnKeyType="done"
          selectionColor={colors.primary}
          autoCorrect={false}
          autoCapitalize="none"
        />

        {/* Verified badge or Verify button */}
        {isVerified ? (
          <Icon name="CheckCircle2" size={18} color="#10B981" />
        ) : localNumber.replace(/\D/g, '').length === 10 && onVerifyPress ? (
          <TouchableOpacity
            onPress={onVerifyPress}
            activeOpacity={0.7}
            style={[styles.verifyBtn, { backgroundColor: colors.primary }]}
          >
            <AppText variant="caption1" weight="semiBold" style={{ color: '#fff' }}>
              Verify
            </AppText>
          </TouchableOpacity>
        ) : null}
      </Animated.View>

      {/* Hint */}
      <AppText style={[styles.hint, { color: colors.mutedForeground }]}>
        10-digit mobile number
      </AppText>

      {/* Error */}
      {!!error && (
        <AppText style={[styles.error, { color: colors.destructive }]}>
          {error}
        </AppText>
      )}
    </AppView>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: 12,
    overflow: 'hidden',
  },
  prefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRightWidth: 1,
  },
  flag: { fontSize: 18 },
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 14,
    letterSpacing: 0.5,
  },
  hint: { fontSize: 12, marginTop: 4 },
  error: { fontSize: 12, marginTop: 2 },
  verifyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
});
