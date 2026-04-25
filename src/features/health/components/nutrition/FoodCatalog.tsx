// ─── FoodCatalog.tsx ──────────────────────────────────────────────────────────
// Inline food catalog widget for NutritionAndGoalSection.
// Filter chips are loaded from the API via useCatalogFilters (useMutation).

import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { AppText, AppView, Card } from '../../../../components';
import { Icon } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { FoodCard } from './FoodCard';
import {
  useFoodCatalog,
  useFavourites,
  useToggleFavourite,
  useCatalogFilters,
  DEFAULT_CATALOG_FILTERS,
} from '../../hooks/useNutrition';
import { navigate } from '../../../../navigation/navigationRef';
import { HealthRoutes, RootRoutes } from '../../../../navigation/routes';
import type { DietFilter, FoodItem, CatalogFilter } from '../../types/nutrition.types';

// ─── Animated Filter Chip ─────────────────────────────────────────────────────

interface ChipProps {
  chip: CatalogFilter;
  isActive: boolean;
  activeColor: string;
  onPress: (id: string) => void;
}

const Chip = memo(({ chip, isActive, activeColor, onPress }: ChipProps) => {
  const progress = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isActive ? 1 : 0, { duration: 180 });
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
    <TouchableOpacity onPress={() => onPress(chip.id)} activeOpacity={0.75}>
      <Animated.View style={[styles.chip, animStyle]}>
        <AppText style={styles.chipEmoji}>{chip.emoji}</AppText>
        <AppText
          variant="caption1"
          weight={isActive ? 'semiBold' : 'regular'}
          color={isActive ? '#ffffff' : undefined}
        >
          {chip.label}
        </AppText>
      </Animated.View>
    </TouchableOpacity>
  );
});

Chip.displayName = 'Chip';

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
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // ── Fetch filter chips from API via useMutation ───────────────────────────
  const {
    mutate: fetchFilters,
    data: filtersResponse,
    isPending: filtersLoading,
  } = useCatalogFilters();

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  // Use API chips if available, fall back to defaults while loading or on error
  const filterChips: CatalogFilter[] =
    filtersResponse?.data?.catalogFilters ?? DEFAULT_CATALOG_FILTERS;

  // ── Food data ─────────────────────────────────────────────────────────────
  const catalogParams =
    activeFilter === 'favourites' || activeFilter === 'all'
      ? undefined
      : { dietType: activeFilter as DietFilter, limit: 10 };

  const { data: catalogData, isLoading: catalogLoading } = useFoodCatalog(catalogParams);
  const { data: favourites, isLoading: favLoading }      = useFavourites();
  const {
    mutate: toggleFav,
    variables: togglingId,
    isPending: isTogglingFav,
  } = useToggleFavourite();

  const displayedFoods: FoodItem[] =
    activeFilter === 'favourites' ? (favourites ?? []) : (catalogData?.foods ?? []);

  const isLoading = activeFilter === 'favourites' ? favLoading : catalogLoading;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFilterPress = useCallback((id: string) => setActiveFilter(id), []);

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

      {/* Filter chips — skeleton while loading */}
      {filtersLoading ? (
        <AppView style={styles.chipRow}>
          {DEFAULT_CATALOG_FILTERS.map(f => (
            <View key={f.id} style={[styles.chipSkeleton, { backgroundColor: colors.border }]} />
          ))}
        </AppView>
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filterChips}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.chipRowList}
          ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
          renderItem={({ item: chip }) => (
            <Chip
              chip={chip}
              isActive={activeFilter === chip.id}
              activeColor={colors.primary}
              onPress={handleFilterPress}
            />
          )}
        />
      )}

      {/* Food list */}
      {isLoading ? (
        <AppView style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </AppView>
      ) : displayedFoods.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={displayedFoods.slice(0, 8)}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.foodList}
          ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <FoodCard
                item={item}
                onPress={handleCardPress}
                onFavouriteToggle={handleFavToggle}
                isTogglingFav={isTogglingFav && togglingId === item._id}
              />
            </View>
          )}
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
  chipRowList: { paddingRight: 4 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chipSkeleton: { width: 72, height: 32, borderRadius: 20, opacity: 0.4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipEmoji: { fontSize: 13 },
  foodList: { paddingVertical: 4, paddingRight: 4 },
  cardWrap: { width: 148 },
  loader: { paddingVertical: 24, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 24, gap: 8, opacity: 0.5 },
});
