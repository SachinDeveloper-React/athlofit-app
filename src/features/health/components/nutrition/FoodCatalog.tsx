// ─── FoodCatalog.tsx ──────────────────────────────────────────────────────────
// Inline food catalog widget for NutritionAndGoalSection.
// Shows filter chips (All / Veg / Non-Veg / Vegan / ❤️ Fav) +
// a horizontal preview of FoodCards + "View All" button.

import React, { memo, useCallback, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { AppText, AppView, Card } from '../../../../components';
import { Icon } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { FoodCard } from './FoodCard';
import {
  useFoodCatalog,
  useFavourites,
  useToggleFavourite,
} from '../../hooks/useNutrition';
import { navigate } from '../../../../navigation/navigationRef';
import { HealthRoutes, RootRoutes } from '../../../../navigation/routes';
import type { DietFilter, FoodItem } from '../../types/nutrition.types';

// ─── Filter Config ────────────────────────────────────────────────────────────

type FilterId = DietFilter | 'favourites';

interface FilterChip {
  id: FilterId;
  label: string;
  emoji: string;
}

const FILTER_CHIPS: FilterChip[] = [
  { id: 'all', label: 'All', emoji: '🍽️' },
  { id: 'veg', label: 'Veg', emoji: '🥦' },
  { id: 'non-veg', label: 'Non-Veg', emoji: '🍗' },
  { id: 'vegan', label: 'Vegan', emoji: '🌱' },
  { id: 'favourites', label: 'Favourites', emoji: '❤️' },
];

// ─── Filter Chip Sub-component ────────────────────────────────────────────────

interface ChipProps {
  chip: FilterChip;
  isActive: boolean;
  activeColor: string;
  onPress: (id: FilterId) => void;
}

const Chip = memo(({ chip, isActive, activeColor, onPress }: ChipProps) => (
  <TouchableOpacity
    onPress={() => onPress(chip.id)}
    activeOpacity={0.75}
    style={[
      styles.chip,
      isActive
        ? { backgroundColor: activeColor, borderColor: activeColor }
        : styles.chipInactive,
    ]}
  >
    <AppText style={styles.chipEmoji}>{chip.emoji}</AppText>
    <AppText
      variant="caption1"
      weight={isActive ? 'semiBold' : 'regular'}
      color={isActive ? '#ffffff' : undefined}
    >
      {chip.label}
    </AppText>
  </TouchableOpacity>
));

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
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');

  // ── Data ──────────────────────────────────────────────────────────────────
  const catalogParams =
    activeFilter === 'favourites' || activeFilter === 'all'
      ? undefined
      : { dietType: activeFilter as DietFilter, limit: 10 };

  const { data: catalogData, isLoading: catalogLoading } =
    useFoodCatalog(catalogParams);
  const { data: favourites, isLoading: favLoading } = useFavourites();
  const { mutate: toggleFav, variables: togglingId } = useToggleFavourite();

  // ── Displayed list ────────────────────────────────────────────────────────
  const displayedFoods: FoodItem[] =
    activeFilter === 'favourites'
      ? (favourites ?? [])
      : (catalogData?.foods ?? []);

  const isLoading =
    activeFilter === 'favourites' ? favLoading : catalogLoading;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFilterPress = useCallback((id: FilterId) => {
    setActiveFilter(id);
  }, []);

  const handleCardPress = useCallback((item: FoodItem) => {
    navigate(RootRoutes.HEALTH_NAVIGATOR, {
      screen: HealthRoutes.FOOD_DETAIL,
      params: { foodId: item._id },
    } as any);
  }, []);

  const handleFavToggle = useCallback(
    (id: string) => {
      toggleFav(id);
    },
    [toggleFav],
  );

  const handleViewAll = useCallback(() => {
    navigate(RootRoutes.HEALTH_NAVIGATOR, {
      screen: HealthRoutes.FOOD_CATALOG,
    } as any);
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
          <AppText variant="caption1" color={colors.primary} weight="semiBold">
            View All
          </AppText>
          <Icon name="ChevronRight" size={14} color={colors.primary} />
        </TouchableOpacity>
      </AppView>

      {/* Filter chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={FILTER_CHIPS}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.chipRow}
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

      {/* Food card list */}
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
                isTogglingFav={togglingId === item._id}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: { gap: 2 },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  chipRow: { paddingRight: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipInactive: {
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  chipEmoji: { fontSize: 13 },
  foodList: { paddingVertical: 4, paddingRight: 4 },
  cardWrap: { width: 148 },
  loader: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
    opacity: 0.5,
  },
});
