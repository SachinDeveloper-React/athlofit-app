import React, { memo, useCallback } from 'react';
import { RefreshControl, ScrollView, ActivityIndicator, View } from 'react-native';
import { AppText, AppView } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { CalorieSummaryCard } from '../nutrition/CalorieSummaryCard';
import { DietPreferenceChips } from '../nutrition/DietPreferenceChips';
import { MealSection } from '../nutrition/MealSection';
import { DietRecommendationCard } from '../nutrition/DietRecommendationCard';
import { FoodCatalog } from '../nutrition/FoodCatalog';
import ChallengeNutritionCard from '../nutrition/ChallengeNutritionCard';
import {
  useNutritionSummary,
  useNutritionPreferences,
  useLogMeal,
  useDeleteMeal,
  useUpdatePreferences,
} from '../../hooks/useNutrition';
import { MEAL_META } from '../../types/nutrition.types';
import type { LogMealRequest, NutritionPreferences } from '../../types/nutrition.types';
import { makeStyles } from '../../../../hooks/makeStyles';

type Props = {
  hidden?: boolean;
};

const useStyles = makeStyles(({ colors, spacing }) => ({
  scroll: {
    gap: spacing[3],
    paddingBottom: spacing[5],
  },
  center: {
    paddingVertical: spacing[15 as any] ?? 60,
    alignItems: 'center' as const,
  },
  sectionLabel: {
    marginBottom: -spacing[1],
    marginTop: spacing[1],
    paddingHorizontal: spacing[0.5],
  },
  bottomSpacer: {
    height: spacing[5],
  },
}));

const SectionLabel = memo(({ label }: { label: string }) => {
  const styles = useStyles();
  return (
    <AppText variant="overline" style={styles.sectionLabel}>
      {label}
    </AppText>
  );
});

SectionLabel.displayName = 'SectionLabel';

const NutritionAndGoalSection = memo(({ hidden }: Props) => {
  const { colors } = useTheme();
  const styles = useStyles();

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

  const { mutate: logMeal, isPending: isAdding } = useLogMeal();
  const { mutate: deleteMeal, isPending: isDeleting } = useDeleteMeal();
  const { mutate: updatePrefs, isPending: isUpdatingPrefs } = useUpdatePreferences();

  const handleAddMeal = useCallback(
    (entry: LogMealRequest) => { logMeal(entry); },
    [logMeal],
  );

  const handleDeleteMeal = useCallback(
    (id: string) => { deleteMeal(id); },
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

  const isLoading = summaryLoading && prefsLoading;

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
      <SectionLabel label="Daily Summary" />
      <CalorieSummaryCard
        caloriesIn={summary?.totalCaloriesIn ?? 0}
        caloriesOut={summary?.caloriesOut ?? 0}
        calorieGoal={preferences?.calorieGoal ?? summary?.calorieGoal ?? 2000}
        protein={summary?.totalProtein ?? 0}
        carbs={summary?.totalCarbs ?? 0}
        fat={summary?.totalFat ?? 0}
      />

      <SectionLabel label="Preference & Goal" />
      <DietPreferenceChips
        preferences={preferences}
        onUpdate={handlePreferencesUpdate}
        isMutating={isUpdatingPrefs}
      />

      <SectionLabel label="Food Catalog" />
      <FoodCatalog />

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

      <SectionLabel label="Recommendation" />
      <DietRecommendationCard goal={preferences?.dietaryGoal ?? 'maintenance'} />

      <SectionLabel label="Challenges" />
      <ChallengeNutritionCard />

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
});

NutritionAndGoalSection.displayName = 'NutritionAndGoalSection';

export default NutritionAndGoalSection;
