// ─── NutritionAndGoalSection.tsx ──────────────────────────────────────────────
// Diet & Nutrition module entry point, rendered as the "Nutrition & Goal" tab
// on the TrackerScreen.  All data flows through React Query (useQuery +
// useMutation) via the `useNutrition*` hooks.

import React, { memo, useCallback } from 'react';
import { StyleSheet, RefreshControl, ScrollView, ActivityIndicator, View } from 'react-native';
import { AppText, AppView } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { CalorieSummaryCard } from '../nutrition/CalorieSummaryCard';
import { DietPreferenceChips } from '../nutrition/DietPreferenceChips';
import { MealSection } from '../nutrition/MealSection';
import { DietRecommendationCard } from '../nutrition/DietRecommendationCard';
import { FoodCatalog } from '../nutrition/FoodCatalog';
import {
  useNutritionSummary,
  useNutritionPreferences,
  useLogMeal,
  useDeleteMeal,
  useUpdatePreferences,
} from '../../hooks/useNutrition';
import { MEAL_META } from '../../types/nutrition.types';
import type { LogMealRequest, NutritionPreferences } from '../../types/nutrition.types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  hidden?: boolean;
};

// ─── Section Label ────────────────────────────────────────────────────────────

const SectionLabel = memo(({ label }: { label: string }) => (
  <AppText variant="overline" style={styles.sectionLabel}>
    {label}
  </AppText>
));

SectionLabel.displayName = 'SectionLabel';

// ─── Component ────────────────────────────────────────────────────────────────

const NutritionAndGoalSection = memo(({ hidden }: Props) => {
  const { colors } = useTheme();

  // ── Data ──────────────────────────────────────────────────────────────────

  const {
    data: summary,
    isLoading: summaryLoading,
    refetch: refetchSummary,
    isRefetching,
  } = useNutritionSummary();

  const {
    data: preferences,
    isLoading: prefsLoading,
    refetch: refetchPrefs,
  } = useNutritionPreferences();

  // ── Mutations ──────────────────────────────────────────────────────────────

  const { mutate: logMeal, isPending: isAdding } = useLogMeal();
  const { mutate: deleteMeal, isPending: isDeleting } = useDeleteMeal();
  const { mutate: updatePrefs, isPending: isUpdatingPrefs } = useUpdatePreferences();

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAddMeal = useCallback(
    (entry: LogMealRequest) => {
      logMeal(entry);
    },
    [logMeal],
  );

  const handleDeleteMeal = useCallback(
    (id: string) => {
      deleteMeal(id);
    },
    [deleteMeal],
  );

  const handlePreferencesUpdate = useCallback(
    (updated: Partial<NutritionPreferences>) => {
      if (!preferences) return;
      updatePrefs({
        dietPreference: updated.dietPreference ?? preferences.dietPreference,
        dietaryGoal: updated.dietaryGoal ?? preferences.dietaryGoal,
        calorieGoal: updated.calorieGoal ?? preferences.calorieGoal,
      });
    },
    [preferences, updatePrefs],
  );

  const handleRefresh = useCallback(() => {
    refetchSummary();
    refetchPrefs();
  }, [refetchSummary, refetchPrefs]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const isLoading = summaryLoading && prefsLoading;

  // ── Render ────────────────────────────────────────────────────────────────

  if (hidden) return null;

  if (isLoading) {
    return (
      <AppView style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <AppText variant="caption1" style={{ marginTop: 12 }}>
          Loading nutrition data…
        </AppText>
      </AppView>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* ─ 1. Calorie Summary ─────────────────────────────────────────────── */}
      <SectionLabel label="Daily Summary" />
      <CalorieSummaryCard
        caloriesIn={summary?.totalCaloriesIn ?? 0}
        caloriesOut={summary?.caloriesOut ?? 0}
        calorieGoal={preferences?.calorieGoal ?? summary?.calorieGoal ?? 2000}
        protein={summary?.totalProtein ?? 0}
        carbs={summary?.totalCarbs ?? 0}
        fat={summary?.totalFat ?? 0}
      />

      {/* ─ 2. Diet Preference & Goal ───────────────────────────────────────── */}
      <SectionLabel label="Preference & Goal" />
      <DietPreferenceChips
        preferences={preferences}
        onUpdate={handlePreferencesUpdate}
        isMutating={isUpdatingPrefs}
      />

      {/* ─ 3. Food Catalog ────────────────────────────────────────────────────── */}
      <SectionLabel label="Food Catalog" />
      <FoodCatalog />

      {/* ─ 4. Meal Log ─────────────────────────────────────────────────────── */}
      <SectionLabel label="Meal Log" />
      {MEAL_META.map(meta => (
        <MealSection
          key={meta.type}
          meta={meta}
          entries={summary?.meals?.[meta.type] ?? []}
          onAddMeal={handleAddMeal}
          onDeleteMeal={handleDeleteMeal}
          isAdding={isAdding}
          isDeleting={isDeleting}
        />
      ))}

      {/* ─ 4. Diet Recommendation ─────────────────────────────────────────── */}
      <SectionLabel label="Recommendation" />
      <DietRecommendationCard
        goal={preferences?.dietaryGoal ?? 'maintenance'}
      />

      {/* Bottom spacing */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
});

NutritionAndGoalSection.displayName = 'NutritionAndGoalSection';

export default NutritionAndGoalSection;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    gap: 12,
    paddingBottom: 20,
  },
  center: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  sectionLabel: {
    marginBottom: -4,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  bottomSpacer: {
    height: 20,
  },
});
