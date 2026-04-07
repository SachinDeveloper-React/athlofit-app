import { useState } from 'react';
import { useTheme } from '../../../../hooks/useTheme';
import { StepperProps } from '../../types/completeProfile.types';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { AppView, AppText } from '../../../../components';

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
    <AppView style={st.wrapper}>
      <AppText
        style={[
          st.label,
          { color: error ? colors.destructive : colors.foreground },
        ]}
      >
        {label}
      </AppText>
      <AppView
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
          <AppText style={[st.btnText, { color: colors.primary }]}>−</AppText>
        </TouchableOpacity>

        <AppView style={st.inputWrap}>
          <TextInput
            style={[st.input, { color: colors.foreground }]}
            value={raw}
            onChangeText={onTextChange}
            keyboardType="numeric"
            textAlign="center"
            selectionColor={colors.primary}
          />
          <AppText style={[st.unit, { color: colors.mutedForeground }]}>
            {unit}
          </AppText>
        </AppView>

        <TouchableOpacity
          onPress={increment}
          style={[st.btn, { borderLeftColor: colors.border }]}
        >
          <AppText style={[st.btnText, { color: colors.primary }]}>+</AppText>
        </TouchableOpacity>
      </AppView>
      {!!error && (
        <AppText style={[st.errorText, { color: colors.destructive }]}>
          {error}
        </AppText>
      )}
    </AppView>
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
