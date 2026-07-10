// ─── FoodCatalog.tsx ──────────────────────────────────────────────────────────
// Inline food catalog widget for NutritionAndGoalSection.
// Diet filtering is driven entirely by user's diet preference selection —
// no local filter chips needed (already selected via DietPreferenceChips).

import React, { memo, useCallback } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { AppText, AppView, Card } from '../../../../components';
import { Icon } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { FoodCard } from './FoodCard';
import {
  useFoodCatalog,
  useFavourites,
  useToggleFavourite,
  useNutritionPreferences,
  useNutritionSummary,
} from '../../hooks/useNutrition';
import { navigate } from '../../../../navigation/navigationRef';
import { HealthRoutes, RootRoutes } from '../../../../navigation/routes';
import type { DietFilter, FoodItem, FoodQueryParams } from '../../types/nutrition.types';

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState = memo(() => (
  <AppView style={styles.empty}>
    <AppText style={{ fontSize: 28 }}>🔍</AppText>
    <AppText variant="caption1">No foods found</AppText>
  </AppView>
));
EmptyState.displayName = 'EmptyState';

// ─── Main Component ───────────────────────────────────────────────────────────

export const FoodCatalog = memo(() => {
  const { colors } = useTheme();

  // ── Use user's diet preference & goal directly (no local filter state) ────
  const { data: preferences } = useNutritionPreferences();
  const { data: summary } = useNutritionSummary();

  const dietPref = preferences?.dietPreference;
  const dietaryGoal = preferences?.dietaryGoal;

  // Build catalog params from user preferences:
  // - If dietPreference is 'all' or not set, don't filter by dietType (show all foods)
  // - Otherwise filter by the selected diet
  const catalogParams: FoodQueryParams = {
    dietType: (!dietPref || dietPref === 'all') ? undefined : (dietPref as DietFilter),
    goal: dietaryGoal,
    limit: 10,
  };

  const { data: catalogData, isLoading: catalogLoading } = useFoodCatalog(catalogParams);
  const { data: favourites }      = useFavourites();
  const {
    mutate: toggleFav,
    variables: togglingId,
    isPending: isTogglingFav,
  } = useToggleFavourite();

  const displayedFoods: FoodItem[] = catalogData?.foods ?? [];
  const isLoading = catalogLoading;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCardPress = useCallback((item: FoodItem) => {
    navigate(RootRoutes.HEALTH_NAVIGATOR, {
      screen: HealthRoutes.FOOD_DETAIL,
      params: { foodId: item._id },
    } as any);
  }, []);

  const handleFavToggle = useCallback((id: string) => toggleFav(id), [toggleFav]);

  const handleViewAll = useCallback(() => {
    navigate(RootRoutes.HEALTH_NAVIGATOR, { screen: HealthRoutes.FOOD_CATALOG } as any);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Card style={styles.card}>
      {/* Header */}
      <AppView style={styles.header}>
        <AppView style={styles.headerLeft}>
          <AppText variant="headline">Food Catalog</AppText>
          <AppText variant="caption2">{catalogData?.total ?? 0} items</AppText>
        </AppView>
        <TouchableOpacity onPress={handleViewAll} activeOpacity={0.75} style={styles.viewAllBtn}>
          <AppText variant="caption1" color={colors.primary} weight="semiBold">View All</AppText>
          <Icon name="ChevronRight" size={14} color={colors.primary} />
        </TouchableOpacity>
      </AppView>

      {/* Food list */}
      {isLoading ? (
        <AppView style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </AppView>
      ) : displayedFoods.length === 0 ? (
        <EmptyState />
      ) : (
        <FlashList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={displayedFoods.slice(0, 8)}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.foodList}
          ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
          renderItem={({ item }) => {
            const intake = summary?.foodIntakeSummary?.find(e => e.foodRef === item._id);
            return (
              <View style={styles.cardWrap}>
                <FoodCard
                  item={item}
                  onPress={handleCardPress}
                  onFavouriteToggle={handleFavToggle}
                  isTogglingFav={isTogglingFav && togglingId === item._id}
                  intakeCount={intake?.totalQuantity}
                  intakeCalories={intake?.totalCalories}
                />
              </View>
            );
          }}
        />
      )}
    </Card>
  );
});

FoodCatalog.displayName = 'FoodCatalog';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: { gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { gap: 2 },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4 },
  foodList: { paddingVertical: 4, paddingRight: 4 },
  cardWrap: { width: 148 },
  loader: { paddingVertical: 24, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 24, gap: 8, opacity: 0.5 },
});
