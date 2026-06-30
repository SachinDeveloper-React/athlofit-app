// ─── DietPreferenceDropdowns.tsx ───────────────────────────────────────────────
// Two dropdown selectors for Diet Preference and Dietary Goal.
// Replaces the old chip-based UI with a cleaner, compact dropdown approach.

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { AppText, AppView } from '../../../../components';
import { Icon } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { useNutritionOptions } from '../../hooks/useNutrition';
import type {
  DietPreference,
  DietaryGoal,
  NutritionPreferences,
  NutritionOption,
} from '../../types/nutrition.types';

// ─── Dropdown Select ──────────────────────────────────────────────────────────

interface DropdownProps {
  label: string;
  options: NutritionOption[];
  selectedValue: string | undefined;
  onSelect: (value: string) => void;
  disabled?: boolean;
}

const DropdownSelect = memo(({ label, options, selectedValue, onSelect, disabled }: DropdownProps) => {
  const { colors, spacing } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const selected = options.find(o => o.value === selectedValue);
  const displayLabel = selected ? `${selected.emoji} ${selected.label}` : 'Select…';

  const handleSelect = useCallback((value: string) => {
    onSelect(value);
    setIsOpen(false);
  }, [onSelect]);

  return (
    <View style={styles.dropdownWrapper}>
      <AppText variant="caption1" weight="semiBold" style={styles.dropdownLabel}>
        {label}
      </AppText>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => !disabled && setIsOpen(true)}
        style={[
          styles.dropdownTrigger,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <AppText variant="subhead" weight="medium" numberOfLines={1} style={{ flex: 1 }}>
          {displayLabel}
        </AppText>
        <Icon name="ChevronDown" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>

      {/* Dropdown Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(100)}
            style={[
              styles.dropdownMenu,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                shadowColor: '#000',
              },
            ]}
          >
            <AppText variant="caption1" weight="semiBold" color={colors.mutedForeground} style={styles.menuTitle}>
              {label}
            </AppText>
            {options.map(option => {
              const isActive = option.value === selectedValue;
              return (
                <TouchableOpacity
                  key={option.value}
                  activeOpacity={0.7}
                  onPress={() => handleSelect(option.value)}
                  style={[
                    styles.menuItem,
                    isActive && { backgroundColor: withOpacity(colors.primary, 0.08) },
                  ]}
                >
                  <AppText style={styles.menuEmoji}>{option.emoji}</AppText>
                  <AppText
                    variant="subhead"
                    weight={isActive ? 'semiBold' : 'regular'}
                    style={{ flex: 1 }}
                  >
                    {option.label}
                  </AppText>
                  {isActive && (
                    <Icon name="Check" size={16} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
});

DropdownSelect.displayName = 'DropdownSelect';

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  preferences: NutritionPreferences | undefined;
  onUpdate: (updated: Partial<NutritionPreferences>) => void;
  isMutating?: boolean;
}

export const DietPreferenceDropdowns = memo(({ preferences, onUpdate, isMutating }: Props) => {
  const { colors } = useTheme();
  const { data: options, isLoading: optionsLoading } = useNutritionOptions();

  const handleDietPrefChange = useCallback(
    (value: string) => {
      if (!preferences) return;
      onUpdate({ ...preferences, dietPreference: value as DietPreference });
    },
    [preferences, onUpdate],
  );

  const handleGoalChange = useCallback(
    (value: string) => {
      if (!preferences) return;
      onUpdate({ ...preferences, dietaryGoal: value as DietaryGoal });
    },
    [preferences, onUpdate],
  );

  const dietPrefs = options?.dietPreferences ?? [];
  const dietGoals = options?.dietaryGoals ?? [];

  if (optionsLoading) {
    return (
      <View style={styles.loaderRow}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DropdownSelect
        label="Dietary Preference"
        options={dietPrefs}
        selectedValue={preferences?.dietPreference}
        onSelect={handleDietPrefChange}
        disabled={isMutating}
      />
      <DropdownSelect
        label="Your Goal"
        options={dietGoals}
        selectedValue={preferences?.dietaryGoal}
        onSelect={handleGoalChange}
        disabled={isMutating}
      />
    </View>
  );
});

DietPreferenceDropdowns.displayName = 'DietPreferenceDropdowns';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  loaderRow: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  dropdownWrapper: {
    gap: 6,
  },
  dropdownLabel: {
    marginLeft: 2,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  dropdownMenu: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 8,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  menuTitle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 10,
    marginHorizontal: 6,
  },
  menuEmoji: {
    fontSize: 18,
  },
});
