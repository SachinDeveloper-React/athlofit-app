import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText, AppView, Header, Screen } from '../../../components';
import { Icon } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { withOpacity } from '../../../utils/withOpacity';
import { useFoodCatalog, useFavourites, useToggleFavourite } from '../hooks/useNutrition';
import { useSearchLog } from '../hooks/useSearchLog';
import { FoodCard } from '../components/nutrition/FoodCard';
import FilterPill from '../components/nutrition/FilterPill';
import { DIET_TYPE_META, FOOD_CATEGORY_META } from '../types/nutrition.types';
import type { DietFilter, FoodCategory, FoodItem } from '../types/nutrition.types';
import { navigate } from '../../../navigation/navigationRef';
import { HealthRoutes, RootRoutes } from '../../../navigation/routes';
import { makeStyles } from '../../../hooks/makeStyles';

const useStyles = makeStyles(({ colors, spacing, radius, fontSize }) => ({
  container: { flex: 1 },
  searchRow: { paddingHorizontal: spacing[4], paddingTop: spacing[3], paddingBottom: spacing[1] },
  searchBox: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing[2], borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing[3], height: 44 },
  searchInput: { flex: 1, fontSize: fontSize.base },
  filterRow: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[2.5], alignItems: 'center' as const },
  categoryRow: { paddingHorizontal: spacing[4], gap: spacing[2], paddingVertical: spacing[2.5] },
  catChip: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing[1.25] ?? 5, paddingHorizontal: spacing[3], borderRadius: radius['2xl'] },
  grid: { paddingHorizontal: spacing[4], paddingTop: spacing[1] },
  columnWrapper: { gap: spacing[2.5], marginBottom: spacing[2.5] },
  gridCell: { flex: 1 },
  loaderWrap: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingTop: spacing[15] ?? 60 },
  empty: { alignItems: 'center' as const, paddingTop: spacing[15] ?? 60 },
}));

const FoodCatalogScreen = memo(() => {
  const { colors } = useTheme();
  const styles = useStyles();

  const [search, setSearch] = useState('');
  const [dietFilter, setDietFilter] = useState<DietFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<FoodCategory>('all');
  const [showFavsOnly, setShowFavsOnly] = useState(false);

  // ── Search logging ──────────────────────────────────────────────────────────────────────
  const { logQuery, logClick } = useSearchLog({ screen: 'FoodCatalog' });

  // Debounce: fire logQuery 600 ms after the user stops typing
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback(
    (text: string) => {
      setSearch(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (text.trim().length >= 2) {
        debounceRef.current = setTimeout(() => logQuery(text), 600);
      }
    },
    [logQuery],
  );
  // Clean up on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const params = useMemo(
    () => ({ dietType: dietFilter, category: categoryFilter, search: search.length >= 2 ? search : undefined, limit: 30 }),
    [dietFilter, categoryFilter, search],
  );

  const { data, isLoading, refetch, isRefetching } = useFoodCatalog(showFavsOnly ? undefined : params);
  const { data: favourites } = useFavourites();
  const { mutate: toggleFav, variables: togglingId, isPending: isTogglingAny } = useToggleFavourite();

  const displayedFoods: FoodItem[] = showFavsOnly ? favourites ?? [] : data?.foods ?? [];

  const handleCardPress = useCallback((item: FoodItem, index: number) => {
    // Log the click with position metadata
    if (search.trim().length >= 2) {
      logClick({ query: search, item, position: index });
    }
    navigate(RootRoutes.HEALTH_NAVIGATOR, { screen: HealthRoutes.FOOD_DETAIL, params: { foodId: item._id } } as any);
  }, [search, logClick]);

  const handleFavToggle = useCallback((id: string) => toggleFav(id), [toggleFav]);

  const renderItem = useCallback(
    ({ item, index }: { item: FoodItem; index: number }) => (
      <Animated.View entering={FadeInDown.delay(index * 40).duration(300)} style={styles.gridCell}>
        <FoodCard
          item={item}
          onPress={item => handleCardPress(item, index)}
          onFavouriteToggle={handleFavToggle}
          isTogglingFav={isTogglingAny && togglingId === item._id}
        />
      </Animated.View>
    ),
    [handleCardPress, handleFavToggle, togglingId, isTogglingAny, styles.gridCell],
  );

  return (
    <Screen padded={false} safeArea={false}>
      <AppView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title="Food Catalog" showBack backLabel="" />

        {/* Search bar */}
        <AppView style={[styles.searchRow, { backgroundColor: colors.background }]}>
          <AppView style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="Search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={handleSearchChange}
              placeholder="Search foods…"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground }]}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => { setSearch(''); }}>
                <Icon name="X" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </AppView>
        </AppView>

        {/* Diet filter row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} style={{ minHeight: 50 }}>
          <FilterPill label="❤️ Saved" emoji="" isActive={showFavsOnly} color="#E63946" onPress={() => setShowFavsOnly(v => !v)} />
          {(Object.keys(DIET_TYPE_META) as DietFilter[]).map(d => {
            const m = DIET_TYPE_META[d as keyof typeof DIET_TYPE_META];
            if (!m) return null;
            return (
              <FilterPill
                key={d}
                label={m.label}
                emoji={m.emoji}
                isActive={!showFavsOnly && dietFilter === d}
                color={m.color}
                onPress={() => { setShowFavsOnly(false); setDietFilter(d === dietFilter ? 'all' : d); }}
              />
            );
          })}
        </ScrollView>

        {/* Category chips */}
        {!showFavsOnly && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow} style={{ minHeight: 50 }}>
            {(Object.keys(FOOD_CATEGORY_META) as FoodCategory[]).map(cat => {
              const m = FOOD_CATEGORY_META[cat];
              const isActive = categoryFilter === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategoryFilter(cat)}
                  activeOpacity={0.75}
                  style={[styles.catChip, isActive ? { backgroundColor: colors.primary } : { backgroundColor: withOpacity(colors.border, 0.3) }]}
                >
                  <AppText style={{ fontSize: 13 }}>{m.emoji}</AppText>
                  <AppText variant="caption1" weight={isActive ? 'semiBold' : 'regular'} color={isActive ? '#fff' : undefined}>
                    {m.label}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {isLoading ? (
          <AppView style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </AppView>
        ) : (
          <FlashList
            data={displayedFoods}
            keyExtractor={item => item._id}
            numColumns={2}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            renderItem={renderItem}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
            ListEmptyComponent={
              <AppView style={styles.empty}>
                <AppText style={{ fontSize: 36 }}>🍽️</AppText>
                <AppText variant="headline" style={{ marginTop: 12 }}>No foods found</AppText>
                <AppText variant="caption1" align="center" style={{ marginTop: 6 }}>
                  {showFavsOnly ? "You haven't saved any favourites yet." : 'Try a different filter or search term.'}
                </AppText>
              </AppView>
            }
            ListFooterComponent={<View style={{ height: 40 }} />}
          />
        )}
      </AppView>
    </Screen>
  );
});

FoodCatalogScreen.displayName = 'FoodCatalogScreen';
export default FoodCatalogScreen;
