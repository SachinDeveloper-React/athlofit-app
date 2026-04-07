// ─── DietPreferenceChips.tsx ──────────────────────────────────────────────────
// Veg / Non-Veg / Vegan selection chips with live API persistence.

import React, { memo, useCallback } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { AppText, AppView, Card } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import type { DietPreference, DietaryGoal, NutritionPreferences } from '../../types/nutrition.types';

// ─── Data ─────────────────────────────────────────────────────────────────────

const DIET_PREFS: { value: DietPreference; label: string; emoji: string }[] = [
  { value: 'veg', label: 'Vegetarian', emoji: '🥦' },
  { value: 'non-veg', label: 'Non-Veg', emoji: '🍗' },
  { value: 'vegan', label: 'Vegan', emoji: '🌱' },
];

const DIETARY_GOALS: { value: DietaryGoal; label: string; emoji: string }[] = [
  { value: 'weight_loss', label: 'Weight Loss', emoji: '🔥' },
  { value: 'muscle_gain', label: 'Muscle Gain', emoji: '💪' },
  { value: 'maintenance', label: 'Maintenance', emoji: '⚖️' },
  { value: 'endurance', label: 'Endurance', emoji: '🏃' },
];

// ─── Chip ─────────────────────────────────────────────────────────────────────

interface ChipProps<T extends string> {
  value: T;
  label: string;
  emoji: string;
  isActive: boolean;
  activeColor: string;
  onPress: (v: T) => void;
  disabled?: boolean;
}

function Chip<T extends string>({
  value,
  label,
  emoji,
  isActive,
  activeColor,
  onPress,
  disabled,
}: ChipProps<T>) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => onPress(value)}
      disabled={disabled}
      style={[
        styles.chip,
        isActive
          ? { backgroundColor: activeColor, borderColor: activeColor }
          : styles.chipInactive,
      ]}
    >
      <AppText style={styles.chipEmoji}>{emoji}</AppText>
      <AppText
        variant="caption1"
        weight={isActive ? 'semiBold' : 'regular'}
        color={isActive ? '#ffffff' : undefined}
        style={styles.chipLabel}
      >
        {label}
      </AppText>
    </TouchableOpacity>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  preferences: NutritionPreferences | undefined;
  onUpdate: (updated: Partial<NutritionPreferences>) => void;
  isMutating?: boolean;
}

export const DietPreferenceChips = memo(
  ({ preferences, onUpdate, isMutating }: Props) => {
    const { colors } = useTheme();

    const handleDietPref = useCallback(
      (value: DietPreference) => {
        if (!preferences || value === preferences.dietPreference) return;
        onUpdate({ ...preferences, dietPreference: value });
      },
      [preferences, onUpdate],
    );

    const handleGoal = useCallback(
      (value: DietaryGoal) => {
        if (!preferences || value === preferences.dietaryGoal) return;
        onUpdate({ ...preferences, dietaryGoal: value });
      },
      [preferences, onUpdate],
    );

    return (
      <Card style={styles.card}>
        {/* ── Diet type ── */}
        <AppText variant="headline">Dietary Preference</AppText>
        <AppView style={styles.row}>
          {DIET_PREFS.map(p => (
            <Chip
              key={p.value}
              value={p.value}
              label={p.label}
              emoji={p.emoji}
              isActive={preferences?.dietPreference === p.value}
              activeColor={colors.primary}
              onPress={handleDietPref}
              disabled={isMutating}
            />
          ))}
        </AppView>

        {/* ── Dietary goal ── */}
        <AppText variant="headline" style={styles.goalLabel}>
          Your Goal
        </AppText>
        <AppView style={styles.row}>
          {DIETARY_GOALS.map(g => (
            <Chip
              key={g.value}
              value={g.value}
              label={g.label}
              emoji={g.emoji}
              isActive={preferences?.dietaryGoal === g.value}
              activeColor={colors.primary}
              onPress={handleGoal}
              disabled={isMutating}
            />
          ))}
        </AppView>
      </Card>
    );
  },
);

DietPreferenceChips.displayName = 'DietPreferenceChips';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalLabel: { marginTop: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipInactive: {
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  chipEmoji: { fontSize: 14 },
  chipLabel: { fontSize: 13 },
});
