import React, { memo, useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  View,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { AppText, AppView, Card } from '../../../../components';
import { Icon } from '../../../../components';
import AlertDialog, { type AlertDialogProps } from '../../../../components/AlertDialog';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { CalorieSummaryCard } from '../nutrition/CalorieSummaryCard';
import { CalorieGoalEditor } from '../nutrition/CalorieGoalEditor';
import { DietPreferenceChips } from '../nutrition/DietPreferenceChips';
import { MealSection } from '../nutrition/MealSection';
import { DietRecommendationCard } from '../nutrition/DietRecommendationCard';
import { FoodCatalog } from '../nutrition/FoodCatalog';
import ChallengeNutritionCard from '../nutrition/ChallengeNutritionCard';
import { useHealthDataStore } from '../../store/healthDataStore';
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
    paddingVertical: (spacing as any)[15] ?? 60,
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

// ─── Collapsible Dropdown Section ─────────────────────────────────────────────

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const CollapsibleSection = memo(({ title, defaultOpen = false, children }: CollapsibleSectionProps) => {
  const { colors, spacing } = useTheme();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const progress = useSharedValue(defaultOpen ? 1 : 0);

  const toggle = useCallback(() => {
    const next = !isOpen;
    setIsOpen(next);
    progress.value = withTiming(next ? 1 : 0, { duration: 250 });
  }, [isOpen, progress]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 180])}deg` }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    maxHeight: interpolate(progress.value, [0, 1], [0, 2000]),
    overflow: 'hidden' as const,
  }));

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={toggle}
        style={[
          dropdownStyles.header,
          {
            backgroundColor: withOpacity(colors.primary, 0.06),
            borderColor: withOpacity(colors.primary, 0.15),
          },
        ]}
      >
        <AppText variant="headline" weight="semiBold">
          {title}
        </AppText>
        <Animated.View style={chevronStyle}>
          <Icon name="ChevronDown" size={18} color={colors.mutedForeground} />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View style={contentStyle}>
        <View style={{ gap: spacing[3], paddingTop: spacing[2] }}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
});

CollapsibleSection.displayName = 'CollapsibleSection';

// ─── Nutrition Disclaimer ─────────────────────────────────────────────────────

const DISCLAIMER_TEXT =
  'Nutrition information (including calories, protein, carbohydrates, fat, and other values) is provided for general informational purposes only. This data is sourced from publicly available food databases and other third-party sources. ATHLOFIT does not claim ownership of this nutritional data and cannot guarantee its complete accuracy or completeness. Nutritional values may vary based on brand, ingredients, preparation methods, and serving size.';

const NutritionDisclaimer = memo(() => {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={[
        dropdownStyles.disclaimer,
        {
          backgroundColor: withOpacity(colors.mutedForeground, 0.05),
          borderColor: withOpacity(colors.mutedForeground, 0.12),
        },
      ]}
    >
      <View style={dropdownStyles.disclaimerHeader}>
        <Icon name="Info" size={14} color={colors.mutedForeground} />
        <AppText variant="caption1" weight="semiBold" color={colors.mutedForeground}>
          Disclaimer
        </AppText>
      </View>
      <AppText
        variant="caption2"
        color={colors.mutedForeground}
        style={{ lineHeight: 18 }}
      >
        {DISCLAIMER_TEXT}
      </AppText>
    </View>
  );
});

NutritionDisclaimer.displayName = 'NutritionDisclaimer';

// ─── Main Section ─────────────────────────────────────────────────────────────

const NutritionAndGoalSection = memo(({ hidden }: Props) => {
  const { colors } = useTheme();
  const styles = useStyles();

  // Read step-based calories burned from health data store
  const caloriesBurned = useHealthDataStore(s => s.data.calories);

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

  // ── Alert dialog state for meal deletion ────────────────────────────────────
  const [alertConfig, setAlertConfig] = useState<Omit<AlertDialogProps, 'visible' | 'onClose'> | null>(null);
  const hideAlert = useCallback(() => setAlertConfig(null), []);

  const handleAddMeal = useCallback(
    (entry: LogMealRequest) => { logMeal(entry); },
    [logMeal],
  );

  const handleDeleteMeal = useCallback(
    (id: string) => {
      // Show confirmation alert before deleting
      setAlertConfig({
        variant: 'warning',
        title: 'Remove Meal Log?',
        message: 'If this meal contributed to a challenge completion, your earned coins will be deducted.',
        details: [
          { emoji: '🪙', text: 'Challenge coins will be reversed' },
          { emoji: '📊', text: 'Challenge progress will update' },
          { emoji: '📜', text: 'Deduction shown in coin history' },
        ],
        actions: [
          { label: 'Cancel', onPress: () => setAlertConfig(null), variant: 'outline' },
          {
            label: 'Remove',
            onPress: () => {
              setAlertConfig(null);
              deleteMeal(id, {
                onSuccess: (response: any) => {
                  const data = response?.data;
                  if (data?.coinsDeducted && data.coinsDeducted > 0) {
                    // Show info about reversed coins
                    const challenges = data.reversedChallenges || [];
                    setAlertConfig({
                      variant: 'info',
                      title: 'Coins Deducted',
                      message: `${data.coinsDeducted} coins were reversed because challenge progress dropped.`,
                      details: challenges.map((c: any) => ({
                        emoji: '🏆',
                        text: `${c.title}: -${c.coinsDeducted} coins`,
                      })),
                      actions: [
                        { label: 'OK', onPress: () => setAlertConfig(null), variant: 'primary' },
                      ],
                    });
                  }
                },
              });
            },
            variant: 'destructive',
          },
        ],
      });
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

  const handleCalorieGoalUpdate = useCallback(
    (newGoal: number) => {
      if (!preferences) return;
      updatePrefs({
        dietPreference: preferences.dietPreference,
        dietaryGoal: preferences.dietaryGoal,
        calorieGoal: newGoal,
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
  <>
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
        caloriesOut={caloriesBurned}
        calorieGoal={preferences?.calorieGoal ?? summary?.calorieGoal ?? 2000}
        protein={summary?.totalProtein ?? 0}
        carbs={summary?.totalCarbs ?? 0}
        fat={summary?.totalFat ?? 0}
      />

      <CalorieGoalEditor
        currentGoal={preferences?.calorieGoal ?? 2000}
        onUpdate={handleCalorieGoalUpdate}
        isMutating={isUpdatingPrefs}
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

      <NutritionDisclaimer />

      <View style={styles.bottomSpacer} />
    </ScrollView>

    {/* Meal deletion confirmation / reversal info alert */}
    <AlertDialog
      visible={alertConfig !== null}
      onClose={hideAlert}
      variant={alertConfig?.variant}
      title={alertConfig?.title ?? ''}
      message={alertConfig?.message}
      details={alertConfig?.details}
      actions={alertConfig?.actions}
      closeOnBackdrop={false}
    />
  </>
  );
});

NutritionAndGoalSection.displayName = 'NutritionAndGoalSection';

export default NutritionAndGoalSection;

// ─── Styles ───────────────────────────────────────────────────────────────────

const dropdownStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  disclaimer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  disclaimerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
