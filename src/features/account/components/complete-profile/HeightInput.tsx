// src/features/account/components/complete-profile/HeightInput.tsx
// Height input with cm/ft toggle. Always outputs value in cm.
// cm mode: text input. ft mode: dropdown selectors for feet & inches.

import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { AppView, AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { cmToFeet, cmToInches, ftInToCm } from '../../../../utils/unitConverter';

type HeightUnit = 'cm' | 'ft';

interface HeightInputProps {
  label?: string;
  /** Value in cm (always stored as cm) */
  value: number | undefined;
  /** Called with value in cm */
  onChange: (cm: number) => void;
  /** Called when user switches unit */
  onUnitChange?: (unit: 'cm' | 'ft') => void;
  /** Initial unit to display (from user's saved preference) */
  initialUnit?: 'cm' | 'ft';
  error?: string;
}

// Generate options for feet (3–7) and inches (0–11)
const FEET_OPTIONS = Array.from({ length: 5 }, (_, i) => i + 3); // 3, 4, 5, 6, 7
const INCH_OPTIONS = Array.from({ length: 12 }, (_, i) => i);    // 0–11

export const HeightInput: React.FC<HeightInputProps> = ({
  label = 'Height',
  value,
  onChange,
  onUnitChange,
  initialUnit = 'cm',
  error,
}) => {
  const { colors } = useTheme();
  const [unit, setUnit] = useState<HeightUnit>(initialUnit);

  // Local state
  const [cmRaw, setCmRaw] = useState(value?.toString() ?? '');
  const [selectedFt, setSelectedFt] = useState(5);
  const [selectedIn, setSelectedIn] = useState(7);

  // Which picker is open
  const [pickerOpen, setPickerOpen] = useState<'ft' | 'in' | null>(null);

  // Sync from external value
  useEffect(() => {
    if (value != null && value > 0) {
      setCmRaw(value.toString());
      setSelectedFt(cmToFeet(value));
      setSelectedIn(cmToInches(value));
    }
  }, [value]);

  const handleUnitToggle = useCallback((newUnit: HeightUnit) => {
    setUnit(newUnit);
    onUnitChange?.(newUnit);
    if (newUnit === 'ft' && value) {
      setSelectedFt(cmToFeet(value));
      setSelectedIn(cmToInches(value));
    } else if (newUnit === 'cm' && value) {
      setCmRaw(value.toString());
    }
  }, [value, onUnitChange]);

  const handleCmChange = useCallback((txt: string) => {
    setCmRaw(txt);
    const num = parseInt(txt, 10);
    if (!isNaN(num) && num >= 0) {
      onChange(num);
    }
  }, [onChange]);

  const handleFtSelect = useCallback((ft: number) => {
    setSelectedFt(ft);
    setPickerOpen(null);
    const cm = ftInToCm(ft, selectedIn);
    if (cm > 0) onChange(cm);
  }, [selectedIn, onChange]);

  const handleInSelect = useCallback((inches: number) => {
    setSelectedIn(inches);
    setPickerOpen(null);
    const cm = ftInToCm(selectedFt, inches);
    if (cm > 0) onChange(cm);
  }, [selectedFt, onChange]);

  return (
    <AppView style={styles.wrapper}>
      {/* Label + Unit Toggle */}
      <AppView style={styles.labelRow}>
        <AppText style={[styles.label, { color: error ? colors.destructive : colors.foreground }]}>
          {label}
        </AppText>
        <AppView style={[styles.toggle, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => handleUnitToggle('cm')}
            style={[styles.toggleBtn, unit === 'cm' && { backgroundColor: colors.primary }]}
          >
            <AppText style={[styles.toggleText, { color: unit === 'cm' ? '#fff' : colors.mutedForeground }]}>
              cm
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleUnitToggle('ft')}
            style={[styles.toggleBtn, unit === 'ft' && { backgroundColor: colors.primary }]}
          >
            <AppText style={[styles.toggleText, { color: unit === 'ft' ? '#fff' : colors.mutedForeground }]}>
              ft
            </AppText>
          </TouchableOpacity>
        </AppView>
      </AppView>

      {/* Input area */}
      {unit === 'cm' ? (
        <AppView style={[styles.inputRow, { backgroundColor: colors.inputBackground, borderColor: error ? colors.destructive : colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            value={cmRaw}
            onChangeText={handleCmChange}
            keyboardType="numeric"
            placeholder="170"
            placeholderTextColor={colors.mutedForeground}
            textAlign="center"
            selectionColor={colors.primary}
          />
          <AppText style={[styles.unit, { color: colors.mutedForeground }]}>cm</AppText>
        </AppView>
      ) : (
        <AppView style={styles.ftRow}>
          {/* Feet selector */}
          <TouchableOpacity
            onPress={() => setPickerOpen('ft')}
            style={[styles.selectorBox, { backgroundColor: colors.inputBackground, borderColor: error ? colors.destructive : colors.border }]}
            activeOpacity={0.7}
          >
            <AppText style={[styles.selectorValue, { color: colors.foreground }]}>
              {selectedFt}
            </AppText>
            <AppText style={[styles.selectorUnit, { color: colors.mutedForeground }]}>ft</AppText>
            <AppText style={[styles.chevron, { color: colors.mutedForeground }]}>▾</AppText>
          </TouchableOpacity>

          {/* Inches selector */}
          <TouchableOpacity
            onPress={() => setPickerOpen('in')}
            style={[styles.selectorBox, { backgroundColor: colors.inputBackground, borderColor: error ? colors.destructive : colors.border }]}
            activeOpacity={0.7}
          >
            <AppText style={[styles.selectorValue, { color: colors.foreground }]}>
              {selectedIn}
            </AppText>
            <AppText style={[styles.selectorUnit, { color: colors.mutedForeground }]}>in</AppText>
            <AppText style={[styles.chevron, { color: colors.mutedForeground }]}>▾</AppText>
          </TouchableOpacity>
        </AppView>
      )}

      {!!error && (
        <AppText style={[styles.errorText, { color: colors.destructive }]}>{error}</AppText>
      )}

      {/* Picker bottom sheet */}
      <Modal
        visible={pickerOpen !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setPickerOpen(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <AppView style={[styles.handle, { backgroundColor: colors.border }]} />
            <AppText style={[styles.sheetTitle, { color: colors.foreground }]}>
              {pickerOpen === 'ft' ? 'Select Feet' : 'Select Inches'}
            </AppText>
            <AppView style={styles.listContainer}>
            <FlashList
              data={pickerOpen === 'ft' ? FEET_OPTIONS : INCH_OPTIONS}
              keyExtractor={item => item.toString()}
              showsVerticalScrollIndicator={false}
              // estimatedItemSize={52}
              renderItem={({ item }) => {
                const isSelected = pickerOpen === 'ft' ? item === selectedFt : item === selectedIn;
                return (
                  <TouchableOpacity
                    onPress={() => pickerOpen === 'ft' ? handleFtSelect(item) : handleInSelect(item)}
                    style={[
                      styles.optionRow,
                      isSelected && { backgroundColor: colors.primary + '15' },
                    ]}
                  >
                    <AppText style={[
                      styles.optionText,
                      { color: isSelected ? colors.primary : colors.foreground },
                      isSelected && { fontWeight: '700' },
                    ]}>
                      {item} {pickerOpen === 'ft' ? 'ft' : 'in'}
                    </AppText>
                    {isSelected && (
                      <AppText style={{ color: colors.primary, fontSize: 18 }}>✓</AppText>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
            </AppView>
          </Pressable>
        </Pressable>
      </Modal>
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    height: 56,
    paddingHorizontal: 16,
  },
  ftRow: {
    flexDirection: 'row',
    gap: 12,
  },
  selectorBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    height: 56,
    paddingHorizontal: 16,
    gap: 6,
  },
  selectorValue: { fontSize: 20, fontWeight: '700' },
  selectorUnit: { fontSize: 14, fontWeight: '500' },
  chevron: { fontSize: 14, marginLeft: 4 },
  input: { fontSize: 20, fontWeight: '600', minWidth: 40, textAlign: 'center' },
  unit: { fontSize: 14, fontWeight: '500', marginLeft: 6 },
  errorText: { fontSize: 12, marginTop: 4 },

  // Picker modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    maxHeight: '50%',
  },
  listContainer: {
    // flex: 1,
    minHeight: 200,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 4,
  },
  optionText: {
    fontSize: 17,
    fontWeight: '500',
  },
});
