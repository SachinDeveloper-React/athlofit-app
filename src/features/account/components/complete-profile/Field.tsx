import { useRef, useState } from 'react';
import { useTheme } from '../../../../hooks/useTheme';
import { FieldProps } from '../../types/completeProfile.types';
import { Animated, StyleSheet, TextInput } from 'react-native';
import { AppView, AppText } from '../../../../components';

import { Icon } from '../../../../components';

export const Field: React.FC<FieldProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  onBlur,
  error,
  keyboardType = 'default',
  returnKeyType = 'next',
  onSubmitEditing,
  inputRef,
  hint,
  isVerified,
}) => {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(anim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };
  const onBlurField = () => {
    setFocused(false);
    Animated.timing(anim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
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
    <AppView style={f.wrapper}>
      <AppText
        style={[
          f.label,
          { color: error ? colors.destructive : colors.foreground },
        ]}
      >
        {label}
      </AppText>
      {hint && (
        <AppText style={[f.hint, { color: colors.mutedForeground }]}>{hint}</AppText>
      )}
      <Animated.View
        style={[
          f.box,
          {
            backgroundColor: colors.inputBackground,
            borderColor,
            borderWidth: focused ? 1.5 : 1,
          },
        ]}
      >
        <TextInput
          ref={inputRef}
          style={[f.input, { color: colors.foreground }]}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlurField}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          selectionColor={colors.primary}
          editable={!isVerified} // If verified, we might want to make it read-only? No, user said email is non-editable. Phone should stay editable even if verified.
        />
        {isVerified && (
          <Icon name="CheckCircle2" size={18} color="#10B981" /> // Emerald green for success
        )}
      </Animated.View>
      {!!error && (
        <AppText style={[f.errorText, { color: colors.destructive }]}>
          {error}
        </AppText>
      )}
    </AppView>
  );
};

const f = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  hint: { fontSize: 12, marginBottom: 6 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 14 },
  errorText: { fontSize: 12, marginTop: 4 },
});
