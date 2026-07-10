// ─── DietPreferenceChips.tsx ──────────────────────────────────────────────────

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
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

// ─── Compact Animated Chip ────────────────────────────────────────────────────

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
  const isFirstRender = useRef(true);

  useEffect(() => {
    // On first render, snap immediately (no animation) to avoid stale frame
    if (isFirstRender.current) {
      isFirstRender.current = false;
      progress.value = isActive ? 1 : 0;
    } else {
      progress.value = withTiming(isActive ? 1 : 0, { duration: 180 });
    }
  }, [isActive]);

  const animStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      backgroundColor: interpolateColor(
        progress.value,
        [0, 1],
        ['rgba(0,0,0,0.03)', activeColor],
      ),
      borderColor: interpolateColor(
        progress.value,
        [0, 1],
        ['rgba(0,0,0,0.08)', activeColor],
      ),
    };
  });

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(value)}
      disabled={disabled}
    >
      <Animated.View style={[styles.chip, animStyle]}>
        <AppText style={styles.chipEmoji}>{emoji}</AppText>
        <AppText
          variant="caption2"
          weight={isActive ? 'bold' : 'medium'}
          color={isActive ? '#ffffff' : undefined}
          style={styles.chipLabel}
        >
          {label}
        </AppText>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Saving Overlay ───────────────────────────────────────────────────────────

const SavingOverlay = memo(({ visible, colors }: { visible: boolean; colors: any }) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 200 });
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
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
      <ActivityIndicator size="small" color={colors.primary} />
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

  const [localDietPref, setLocalDietPref] = useState<DietPreference | undefined>(undefined);
  const [localGoal, setLocalGoal] = useState<DietaryGoal | undefined>(undefined);

  const activeDietPref = localDietPref ?? preferences?.dietPreference;
  const activeGoal = localGoal ?? preferences?.dietaryGoal;

  // Clear optimistic local state once the server confirms the new value
  // OR when the server returns a different value (e.g. mutation failed,
  // or a fresh refetch/pull-to-refresh returns updated data).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (localDietPref !== undefined && preferences?.dietPreference !== undefined) {
      setLocalDietPref(undefined);
    }
  }, [preferences?.dietPreference]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (localGoal !== undefined && preferences?.dietaryGoal !== undefined) {
      setLocalGoal(undefined);
    }
  }, [preferences?.dietaryGoal]);

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

  const dietPrefs = options?.dietPreferences ?? [];
  const dietGoals = options?.dietaryGoals ?? [];

  if (optionsLoading) {
    return (
      <Card style={styles.card}>
        <ActivityIndicator size="small" color={colors.primary} />
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      {/* Diet Preference Row */}
      <View style={styles.section}>
        <AppText variant="caption1" weight="semiBold" color={colors.mutedForeground}>
          Diet
        </AppText>
        <View style={styles.row}>
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
        </View>
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: withOpacity(colors.foreground, 0.06) }]} />

      {/* Goal Row */}
      <View style={styles.section}>
        <AppText variant="caption1" weight="semiBold" color={colors.mutedForeground}>
          Goal
        </AppText>
        <View style={styles.row}>
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
        </View>
      </View>

      <SavingOverlay visible={!!isMutating} colors={colors} />
    </Card>
  );
});

DietPreferenceChips.displayName = 'DietPreferenceChips';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  section: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  divider: {
    height: 1,
    borderRadius: 1,
    marginVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.2,
  },
  chipEmoji: { fontSize: 12 },
  chipLabel: { fontSize: 11.5 },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
