import { useState } from 'react';
import { useTheme } from '../../../../hooks/useTheme';
import { StepperProps } from '../../types/completeProfile.types';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export const NumericStepper: React.FC<StepperProps> = ({
  label,
  unit,
  value,
  onChange,
  error,
  min,
  max,
  step = 1,
}) => {
  const { colors } = useTheme();
  const [raw, setRaw] = useState(value?.toString() ?? '');

  const decrement = () => {
    const next = Math.max(min, (value ?? min) - step);
    onChange(next);
    setRaw(String(next));
  };
  const increment = () => {
    const next = Math.min(max, (value ?? min) + step);
    onChange(next);
    setRaw(String(next));
  };
  const onTextChange = (txt: string) => {
    setRaw(txt);
    const num = parseFloat(txt);
    if (!isNaN(num)) onChange(num);
  };

  return (
    <View style={st.wrapper}>
      <Text
        style={[
          st.label,
          { color: error ? colors.destructive : colors.foreground },
        ]}
      >
        {label}
      </Text>
      <View
        style={[
          st.row,
          {
            backgroundColor: colors.inputBackground,
            borderColor: error ? colors.destructive : colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={decrement}
          style={[st.btn, { borderRightColor: colors.border }]}
        >
          <Text style={[st.btnText, { color: colors.primary }]}>−</Text>
        </TouchableOpacity>

        <View style={st.inputWrap}>
          <TextInput
            style={[st.input, { color: colors.foreground }]}
            value={raw}
            onChangeText={onTextChange}
            keyboardType="numeric"
            textAlign="center"
            selectionColor={colors.primary}
          />
          <Text style={[st.unit, { color: colors.mutedForeground }]}>
            {unit}
          </Text>
        </View>

        <TouchableOpacity
          onPress={increment}
          style={[st.btn, { borderLeftColor: colors.border }]}
        >
          <Text style={[st.btnText, { color: colors.primary }]}>+</Text>
        </TouchableOpacity>
      </View>
      {!!error && (
        <Text style={[st.errorText, { color: colors.destructive }]}>
          {error}
        </Text>
      )}
    </View>
  );
};

const st = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    height: 56,
  },
  btn: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  btnText: { fontSize: 24, fontWeight: '300', lineHeight: 30 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  input: { fontSize: 20, fontWeight: '600', minWidth: 60, textAlign: 'center' },
  unit: { fontSize: 14, fontWeight: '500' },
  errorText: { fontSize: 12, marginTop: 4 },
});
