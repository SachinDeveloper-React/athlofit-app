// src/features/account/components/complete-profile/WeightInput.tsx
// Weight input with kg/lbs toggle. Always outputs value in kg.

import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { AppView, AppText, Icon } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { kgToLbs, lbsToKg } from '../../../../utils/unitConverter';

type WeightUnit = 'kg' | 'lbs';

interface WeightInputProps {
  label?: string;
  /** Value in kg (always stored as kg) */
  value: number | undefined;
  /** Called with value in kg */
  onChange: (kg: number) => void;
  /** Called when user switches unit */
  onUnitChange?: (unit: 'kg' | 'lbs') => void;
  /** Initial unit to display (from user's saved preference) */
  initialUnit?: 'kg' | 'lbs';
  error?: string;
  min?: number;
  max?: number;
  step?: number;
}

export const WeightInput: React.FC<WeightInputProps> = ({
  label = 'Weight',
  value,
  onChange,
  onUnitChange,
  initialUnit = 'kg',
  error,
  min = 20,
  max = 300,
  step = 0.5,
}) => {
  const { colors } = useTheme();
  const [unit, setUnit] = useState<WeightUnit>(initialUnit);
  const [raw, setRaw] = useState(() => {
    if (value != null && value > 0) {
      return initialUnit === 'lbs' ? kgToLbs(value).toString() : value.toString();
    }
    return value?.toString() ?? '';
  });

  // Sync from external value when it changes
  useEffect(() => {
    if (value != null && value > 0) {
      if (unit === 'kg') {
        setRaw(value.toString());
      } else {
        setRaw(kgToLbs(value).toString());
      }
    }
  }, [value]);

  const handleUnitToggle = useCallback((newUnit: WeightUnit) => {
    if (newUnit === unit) return;
    setUnit(newUnit);
    onUnitChange?.(newUnit);
    if (value != null && value > 0) {
      if (newUnit === 'lbs') {
        setRaw(kgToLbs(value).toString());
      } else {
        setRaw(value.toString());
      }
    }
  }, [unit, value, onUnitChange]);

  const handleTextChange = useCallback((txt: string) => {
    setRaw(txt);
    const num = parseFloat(txt);
    if (!isNaN(num) && num >= 0) {
      const kg = unit === 'lbs' ? lbsToKg(num) : num;
      onChange(kg);
    }
  }, [unit, onChange]);

  const currentDisplayValue = parseFloat(raw) || 0;

  const decrement = useCallback(() => {
    const stepInUnit = unit === 'lbs' ? 1 : step;
    const next = Math.max(
      unit === 'lbs' ? kgToLbs(min) : min,
      currentDisplayValue - stepInUnit,
    );
    const rounded = Math.round(next * 10) / 10;
    setRaw(rounded.toString());
    const kg = unit === 'lbs' ? lbsToKg(rounded) : rounded;
    onChange(kg);
  }, [unit, step, min, currentDisplayValue, onChange]);

  const increment = useCallback(() => {
    const stepInUnit = unit === 'lbs' ? 1 : step;
    const next = Math.min(
      unit === 'lbs' ? kgToLbs(max) : max,
      currentDisplayValue + stepInUnit,
    );
    const rounded = Math.round(next * 10) / 10;
    setRaw(rounded.toString());
    const kg = unit === 'lbs' ? lbsToKg(rounded) : rounded;
    onChange(kg);
  }, [unit, step, max, currentDisplayValue, onChange]);

  return (
    <AppView style={styles.wrapper}>
      {/* Label + Unit Toggle */}
      <AppView style={styles.labelRow}>
        <AppText style={[styles.label, { color: error ? colors.destructive : colors.foreground }]}>
          {label}
        </AppText>
        <AppView style={[styles.toggle, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => handleUnitToggle('kg')}
            style={[styles.toggleBtn, unit === 'kg' && { backgroundColor: colors.primary }]}
          >
            <AppText style={[styles.toggleText, { color: unit === 'kg' ? '#fff' : colors.mutedForeground }]}>
              kg
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleUnitToggle('lbs')}
            style={[styles.toggleBtn, unit === 'lbs' && { backgroundColor: colors.primary }]}
          >
            <AppText style={[styles.toggleText, { color: unit === 'lbs' ? '#fff' : colors.mutedForeground }]}>
              lbs
            </AppText>
          </TouchableOpacity>
        </AppView>
      </AppView>

      {/* Stepper Input */}
      <AppView
        style={[
          styles.row,
          {
            backgroundColor: colors.inputBackground,
            borderColor: error ? colors.destructive : colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={decrement}
          style={[styles.btn, { borderRightColor: colors.border }]}
        >
          <Icon name="Minus" size={18} color={colors.primary} />
        </TouchableOpacity>

        <AppView style={styles.inputWrap}>
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            value={raw}
            onChangeText={handleTextChange}
            keyboardType="numeric"
            textAlign="center"
            selectionColor={colors.primary}
          />
          <AppText style={[styles.unit, { color: colors.mutedForeground }]}>
            {unit}
          </AppText>
        </AppView>

        <TouchableOpacity
          onPress={increment}
          style={[styles.btn, { borderLeftColor: colors.border }]}
        >
          <Icon name="Plus" size={18} color={colors.primary} />
        </TouchableOpacity>
      </AppView>

      {!!error && (
        <AppText style={[styles.errorText, { color: colors.destructive }]}>{error}</AppText>
      )}
    </AppView>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: { fontSize: 14, fontWeight: '500' },
  toggle: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  toggleText: { fontSize: 13, fontWeight: '600' },
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
