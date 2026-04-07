// ─── MealLogBottomSheet.tsx ───────────────────────────────────────────────────
// Bottom sheet form to log a new food item for a given meal type.

import React, { memo, useCallback, useState } from 'react';
import { ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import BottomSheet from '../../../../components/BottomSheet';
import { AppText, AppView, Button, Input } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import type { LogMealRequest, MealMeta, MealUnit } from '../../types/nutrition.types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  meal: MealMeta;
  onClose: () => void;
  onSubmit: (entry: LogMealRequest) => void;
  isSubmitting?: boolean;
}

// ─── Unit selector ────────────────────────────────────────────────────────────

const UNITS: MealUnit[] = ['g', 'ml', 'serving', 'piece'];

// ─── Component ────────────────────────────────────────────────────────────────

export const MealLogBottomSheet = memo(
  ({ visible, meal, onClose, onSubmit, isSubmitting }: Props) => {
    const { colors } = useTheme();

    const [name, setName] = useState('');
    const [calories, setCalories] = useState('');
    const [protein, setProtein] = useState('');
    const [carbs, setCarbs] = useState('');
    const [fat, setFat] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [unit, setUnit] = useState<MealUnit>('serving');
    const [errors, setErrors] = useState<{ name?: string; calories?: string }>({});

    const reset = useCallback(() => {
      setName('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      setQuantity('1');
      setUnit('serving');
      setErrors({});
    }, []);

    const handleClose = useCallback(() => {
      reset();
      onClose();
    }, [reset, onClose]);

    const validate = useCallback(() => {
      const err: typeof errors = {};
      if (!name.trim()) err.name = 'Food name is required';
      if (!calories.trim() || isNaN(Number(calories)) || Number(calories) <= 0)
        err.calories = 'Enter a valid calorie amount';
      setErrors(err);
      return Object.keys(err).length === 0;
    }, [name, calories]);

    const handleSubmit = useCallback(() => {
      if (!validate()) return;
      const entry: LogMealRequest = {
        mealType: meal.type,
        name: name.trim(),
        calories: Number(calories),
        protein: protein ? Number(protein) : undefined,
        carbs: carbs ? Number(carbs) : undefined,
        fat: fat ? Number(fat) : undefined,
        quantity: quantity ? Number(quantity) : undefined,
        unit: unit,
      };
      onSubmit(entry);
      reset();
    }, [validate, meal.type, name, calories, protein, carbs, fat, quantity, unit, onSubmit, reset]);

    return (
      <BottomSheet
        visible={visible}
        onClose={handleClose}
        title={`Log ${meal.label}`}
        snapHeight="85%"
        showCloseButton
        closeOnBackdrop={!isSubmitting}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scroll}
          >
            {/* Meal badge */}
            <AppView style={styles.mealBadge}>
              <AppText style={styles.mealEmoji}>{meal.emoji}</AppText>
              <AppView>
                <AppText variant="headline">{meal.label}</AppText>
                <AppText variant="caption2">{meal.timeHint}</AppText>
              </AppView>
            </AppView>

            {/* Food name */}
            <Input
              label="Food Name *"
              placeholder="e.g. Grilled Chicken"
              value={name}
              onChangeText={setName}
              error={errors.name}
              autoCapitalize="words"
            />

            {/* Calories */}
            <Input
              label="Calories (kcal) *"
              placeholder="e.g. 350"
              value={calories}
              onChangeText={setCalories}
              keyboardType="numeric"
              error={errors.calories}
            />

            {/* Quantity + Unit row */}
            <AppView style={styles.qtyRow}>
              <Input
                label="Quantity"
                placeholder="1"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                containerStyle={styles.qtyInput}
              />
              <AppView style={styles.unitWrap}>
                <AppText variant="label" style={styles.unitLabel}>
                  Unit
                </AppText>
                <AppView style={styles.unitChips}>
                  {UNITS.map(u => (
                    <AppView
                      key={u}
                      style={[
                        styles.unitChip,
                        unit === u
                          ? { backgroundColor: colors.primary }
                          : { borderColor: colors.border, borderWidth: 1 },
                      ]}
                      onTouchEnd={() => setUnit(u)}
                    >
                      <AppText
                        variant="caption1"
                        weight={unit === u ? 'semiBold' : 'regular'}
                        color={unit === u ? '#fff' : undefined}
                      >
                        {u}
                      </AppText>
                    </AppView>
                  ))}
                </AppView>
              </AppView>
            </AppView>

            {/* Macros */}
            <AppText variant="label" style={styles.macroHeader}>
              Macronutrients (optional)
            </AppText>
            <AppView style={styles.macroRow}>
              <Input
                label="Protein (g)"
                placeholder="0"
                value={protein}
                onChangeText={setProtein}
                keyboardType="numeric"
                containerStyle={styles.macroInput}
              />
              <Input
                label="Carbs (g)"
                placeholder="0"
                value={carbs}
                onChangeText={setCarbs}
                keyboardType="numeric"
                containerStyle={styles.macroInput}
              />
              <Input
                label="Fat (g)"
                placeholder="0"
                value={fat}
                onChangeText={setFat}
                keyboardType="numeric"
                containerStyle={styles.macroInput}
              />
            </AppView>

            {/* Submit */}
            <Button
              label="Log Meal"
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={styles.submitBtn}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </BottomSheet>
    );
  },
);

MealLogBottomSheet.displayName = 'MealLogBottomSheet';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  kav: { flex: 1 },
  scroll: { paddingBottom: 24 },
  mealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
    padding: 12,
  },
  mealEmoji: { fontSize: 28 },
  qtyRow: { flexDirection: 'row', gap: 12 },
  qtyInput: { width: 100 },
  unitWrap: { flex: 1 },
  unitLabel: { marginBottom: 6 },
  unitChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  unitChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  macroHeader: { marginBottom: 8 },
  macroRow: { flexDirection: 'row', gap: 8 },
  macroInput: { flex: 1, marginBottom: 0 },
  submitBtn: { marginTop: 8 },
});
