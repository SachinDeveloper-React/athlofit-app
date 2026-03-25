import { useRef, useState } from 'react';
import { useTheme } from '../../../../hooks/useTheme';
import { FieldProps } from '../../types/completeProfile.types';
import { Animated, StyleSheet, Text, TextInput, View } from 'react-native';

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
    <View style={f.wrapper}>
      <Text
        style={[
          f.label,
          { color: error ? colors.destructive : colors.foreground },
        ]}
      >
        {label}
      </Text>
      {hint && (
        <Text style={[f.hint, { color: colors.mutedForeground }]}>{hint}</Text>
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
        />
      </Animated.View>
      {!!error && (
        <Text style={[f.errorText, { color: colors.destructive }]}>
          {error}
        </Text>
      )}
    </View>
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
