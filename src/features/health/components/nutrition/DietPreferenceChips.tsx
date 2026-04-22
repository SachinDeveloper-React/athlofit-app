// ─── DietPreferenceChips.tsx ──────────────────────────────────────────────────

import React, { memo, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { AppText, AppView, Card } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { useNutritionOptions } from '../../hooks/useNutrition';
import type {
  DietPreference,
  DietaryGoal,
  NutritionPreferences,
  NutritionOption,
} from '../../types/nutrition.types';

// ─── Animated Chip ────────────────────────────────────────────────────────────

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
  value, label, emoji, isActive, activeColor, onPress, disabled,
}: ChipProps<T>) {
  const progress = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isActive ? 1 : 0, { duration: 200 });
  }, [isActive]);

  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['rgba(0,0,0,0.03)', activeColor],
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      ['rgba(0,0,0,0.1)', activeColor],
    ),
  }));

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => onPress(value)}
      disabled={disabled}
    >
      <Animated.View style={[styles.chip, animStyle]}>
        <AppText style={styles.chipEmoji}>{emoji}</AppText>
        <AppText
          variant="caption1"
          weight={isActive ? 'semiBold' : 'regular'}
          color={isActive ? '#ffffff' : undefined}
          style={styles.chipLabel}
        >
          {label}
        </AppText>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Overlay ──────────────────────────────────────────────────────────────────

const SavingOverlay = memo(({ visible, colors }: { visible: boolean; colors: any }) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 200 });
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    // pointerEvents handled by parent wrapper
  }));

  return (
    <Animated.View
      style={[
        styles.overlay,
        { backgroundColor: withOpacity(colors.card, 0.82) },
        overlayStyle,
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Animated.View style={[styles.spinnerWrap, { backgroundColor: colors.card }]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <AppText variant="caption1" style={{ marginTop: 6, color: colors.mutedForeground }}>
          Saving…
        </AppText>
      </Animated.View>
    </Animated.View>
  );
});

SavingOverlay.displayName = 'SavingOverlay';

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  preferences: NutritionPreferences | undefined;
  onUpdate: (updated: Partial<NutritionPreferences>) => void;
  isMutating?: boolean;
}

export const DietPreferenceChips = memo(({ preferences, onUpdate, isMutating }: Props) => {
  const { colors } = useTheme();
  const { data: options, isLoading: optionsLoading } = useNutritionOptions();

  // Optimistic local state — switches instantly on tap
  const [localDietPref, setLocalDietPref] = useState<DietPreference | undefined>(undefined);
  const [localGoal, setLocalGoal]         = useState<DietaryGoal | undefined>(undefined);

  const activeDietPref = localDietPref ?? preferences?.dietPreference;
  const activeGoal     = localGoal     ?? preferences?.dietaryGoal;

  // Clear optimistic state only when the server value has caught up to what we set.
  // This prevents the chip from flashing back to the old value between mutation
  // settling and the React Query cache being invalidated + refetched.
  useEffect(() => {
    if (localDietPref !== undefined && preferences?.dietPreference === localDietPref) {
      setLocalDietPref(undefined);
    }
  }, [preferences?.dietPreference, localDietPref]);

  useEffect(() => {
    if (localGoal !== undefined && preferences?.dietaryGoal === localGoal) {
      setLocalGoal(undefined);
    }
  }, [preferences?.dietaryGoal, localGoal]);

  const handleDietPref = useCallback(
    (value: string) => {
      if (!preferences || value === activeDietPref) return;
      setLocalDietPref(value as DietPreference);
      onUpdate({ ...preferences, dietPreference: value as DietPreference });
    },
    [preferences, activeDietPref, onUpdate],
  );

  const handleGoal = useCallback(
    (value: string) => {
      if (!preferences || value === activeGoal) return;
      setLocalGoal(value as DietaryGoal);
      onUpdate({ ...preferences, dietaryGoal: value as DietaryGoal });
    },
    [preferences, activeGoal, onUpdate],
  );

  const dietPrefs  = options?.dietPreferences ?? [];
  const dietGoals  = options?.dietaryGoals    ?? [];

  return (
    <Card style={styles.card}>
      <AppText variant="headline">Dietary Preference</AppText>
      {optionsLoading ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start' }} />
      ) : (
        <AppView style={styles.row}>
          {dietPrefs.map(p => (
            <Chip
              key={p.value}
              value={p.value}
              label={p.label}
              emoji={p.emoji}
              isActive={activeDietPref === p.value}
              activeColor={colors.primary}
              onPress={handleDietPref}
              disabled={isMutating}
            />
          ))}
        </AppView>
      )}

      <AppText variant="headline" style={styles.goalLabel}>Your Goal</AppText>
      {optionsLoading ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start' }} />
      ) : (
        <AppView style={styles.row}>
          {dietGoals.map(g => (
            <Chip
              key={g.value}
              value={g.value}
              label={g.label}
              emoji={g.emoji}
              isActive={activeGoal === g.value}
              activeColor={colors.primary}
              onPress={handleGoal}
              disabled={isMutating}
            />
          ))}
        </AppView>
      )}

      {/* Always mounted — fades in/out smoothly via Reanimated */}
      <SavingOverlay visible={!!isMutating} colors={colors} />
    </Card>
  );
});

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
  chipEmoji: { fontSize: 14 },
  chipLabel: { fontSize: 13 },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerWrap: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
});
