// src/features/shop/screens/ShopScreen.tsx
import React, { memo, useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RootRoutes, ShopRoutes } from '../../../navigation/routes';
import type { RootStackParamList } from '../../../types/navigation.types';
import { useTheme } from '../../../hooks/useTheme';
import AppText from '../../../components/AppText';
import { Icon } from '../../../components/Icon';
import { CoinBadge } from '../../../components/CoinBadge';
import { withOpacity } from '../../../utils/withOpacity';
import { useShopState } from '../hooks/useShop';
import CategoryPill from '../components/CategoryPill';
import FeaturedCard from '../components/FeaturedCard';
import ProductCard, { CARD_WIDTH } from '../components/ProductCard';
import type { Category, Product } from '../types/shop.types';
import { useCart } from '../context/CartContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_GAP = 12;
type ShopNavProp = NativeStackNavigationProp<RootStackParamList>;

const SORT_OPTIONS = [
  { key: 'newest',     label: 'Newest'     },
  { key: 'price_asc',  label: 'Price ↑'    },
  { key: 'price_desc', label: 'Price ↓'    },
  { key: 'rating',     label: 'Top Rated'  },
] as const;

// ─── Static header — animates in ONCE on mount, never re-animates ─────────────
// Receives only stable callbacks and data that doesn't change on sort/category.

type StaticHeaderProps = {
  insetTop: number;
  categories: Category[];
  featuredProducts: Product[];
  selectedCategory: string;
  itemCount: number;
  onGoToCart: () => void;
  onGoToSearch: () => void;
  onGoToOrders: () => void;
  onCategoryPress: (slug: string) => void;
  onProductPress: (product: Product) => void;
};

const StaticHeader = memo(({
  insetTop,
  categories,
  featuredProducts,
  selectedCategory,
  itemCount,
  onGoToCart,
  onGoToSearch,
  onGoToOrders,
  onCategoryPress,
  onProductPress,
}: StaticHeaderProps) => {
  const { colors } = useTheme();

  return (
    // entering fires only when this component MOUNTS — never on re-render
    <Animated.View entering={FadeInDown.duration(350)}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insetTop + 8, paddingHorizontal: 16 }]}>
        <View style={{ flex: 1 }}>
          <AppText variant="largeTitle" weight="bold">Shop</AppText>
          <AppText variant="caption1" secondary style={{ marginTop: 1 }}>Spend your fitness coins</AppText>
        </View>
        <View style={styles.topActions}>
          <CoinBadge />
          <Pressable onPress={onGoToOrders} style={[styles.iconBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Icon name="Package" size={18} color={colors.foreground} />
          </Pressable>
          <Pressable onPress={onGoToCart} style={[styles.iconBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Icon name="ShoppingCart" size={18} color={colors.foreground} />
            {itemCount > 0 && (
              <View style={[styles.cartBadge, { backgroundColor: colors.primary }]}>
                <AppText variant="caption2" weight="bold" color="#fff" style={{ fontSize: 9 }}>
                  {itemCount > 9 ? '9+' : itemCount}
                </AppText>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Search bar */}
      <Pressable
        onPress={onGoToSearch}
        style={[styles.searchBar, { backgroundColor: colors.secondary, borderColor: colors.border, marginHorizontal: 16, marginTop: 14 }]}
      >
        <Icon name="Search" size={17} color={colors.mutedForeground} />
        <AppText variant="subhead" secondary style={{ flex: 1, marginLeft: 10 }}>
          Search supplements, gear…
        </AppText>
        <View style={[styles.searchKbd, { backgroundColor: colors.muted }]}>
          <AppText variant="caption2" secondary>⌘K</AppText>
        </View>
      </Pressable>

      {/* Categories */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14, gap: 8 }}
      >
        {categories.map(cat => (
          <CategoryPill
            key={cat.slug}
            category={cat}
            isSelected={selectedCategory === cat.slug}
            onPress={onCategoryPress}
          />
        ))}
      </ScrollView>

      {/* Featured */}
      {featuredProducts.length > 0 && (
        <View style={{ marginBottom: 4 }}>
          <View style={[styles.sectionRow, { paddingHorizontal: 16, marginBottom: 12 }]}>
            <View>
              <AppText variant="title3" weight="bold">Featured</AppText>
              <AppText variant="caption1" secondary style={{ marginTop: 2 }}>Hand-picked for your goals</AppText>
            </View>
            <Pressable style={[styles.seeAllBtn, { borderColor: colors.border }]}>
              <AppText variant="caption1" color={colors.primary} weight="semiBold">See all</AppText>
              <Icon name="ChevronRight" size={13} color={colors.primary} />
            </Pressable>
          </View>
          <FlatList
            data={featuredProducts}
            keyExtractor={item => item._id}
            renderItem={({ item, index }) => (
              <FeaturedCard product={item} index={index} onPress={onProductPress} />
            )}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 16, paddingRight: 4 }}
            snapToInterval={SCREEN_WIDTH * 0.74 + 12}
            decelerationRate="fast"
          />
        </View>
      )}
    </Animated.View>
  );
});

StaticHeader.displayName = 'StaticHeader';

// ─── Dynamic section header — no animation, updates freely ───────────────────

type DynamicSectionProps = {
  selectedCategory: string;
  categories: Category[];
  pagination: { total: number } | null;
  sortBy: string;
  isProductsPending: boolean;
  onSortChange: (sort: any) => void;
};

const DynamicSection = memo(({
  selectedCategory,
  categories,
  pagination,
  sortBy,
  isProductsPending,
  onSortChange,
}: DynamicSectionProps) => {
  const { colors } = useTheme();

  return (
    <View>
      {/* Section title + count */}
      <View style={[styles.sectionRow, { paddingHorizontal: 16, marginTop: 20, marginBottom: 4 }]}>
        <View>
          <AppText variant="title3" weight="bold">
            {selectedCategory === 'all'
              ? 'All Products'
              : categories.find(c => c.slug === selectedCategory)?.name ?? 'Products'}
          </AppText>
          {pagination && (
            <AppText variant="caption1" secondary style={{ marginTop: 2 }}>
              {pagination.total} item{pagination.total !== 1 ? 's' : ''}
            </AppText>
          )}
        </View>
      </View>

      {/* Sort pills */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}
      >
        {SORT_OPTIONS.map(opt => {
          const active = sortBy === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => onSortChange(opt.key)}
              style={[
                styles.sortPill,
                {
                  backgroundColor: active ? colors.primary : colors.secondary,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <AppText variant="caption1" weight="semiBold" color={active ? '#fff' : colors.mutedForeground}>
                {opt.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Skeleton — only while products are loading after sort/category change */}
      {isProductsPending && (
        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.row, { gap: COLUMN_GAP, marginBottom: COLUMN_GAP }]}>
              {[0, 1].map(j => (
                <View
                  key={j}
                  style={{ width: CARD_WIDTH, height: 220, borderRadius: 16, backgroundColor: colors.secondary, opacity: 0.5 }}
                />
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
});

DynamicSection.displayName = 'DynamicSection';

// ─── Screen ───────────────────────────────────────────────────────────────────

const ShopScreen = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ShopNavProp>();
  const { itemCount } = useCart();

  const {
    categories, featuredProducts, products, pagination,
    selectedCategory, isLoading, isRefreshing, isProductsPending,
    loadInitialData, loadByCategory, loadMore, onRefresh, setSortBy, sortBy,
  } = useShopState();

  useEffect(() => { loadInitialData(); }, []);

  const handleProductPress = useCallback((product: Product) => {
    navigation.navigate(RootRoutes.SHOP_NAVIGATOR, {
      screen: ShopRoutes.PRODUCT_DETAIL,
      params: { productId: product._id },
    });
  }, [navigation]);

  const goToCart    = useCallback(() => navigation.navigate(RootRoutes.SHOP_NAVIGATOR, { screen: ShopRoutes.CART }), [navigation]);
  const goToSearch  = useCallback(() => navigation.navigate(RootRoutes.SHOP_NAVIGATOR, { screen: ShopRoutes.SHOP_SEARCH }), [navigation]);
  const goToOrders  = useCallback(() => navigation.navigate(RootRoutes.SHOP_NAVIGATOR, { screen: ShopRoutes.ORDER_HISTORY }), [navigation]);

  const rows: Product[][] = [];
  for (let i = 0; i < products.length; i += 2) {
    rows.push(products.slice(i, i + 2));
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isLoading && products.length === 0 ? (
        <View style={[styles.loader, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText variant="body" secondary style={{ marginTop: 12 }}>Loading shop…</AppText>
        </View>
      ) : (
        <FlatList
          data={isProductsPending ? [] : rows}
          keyExtractor={(_, i) => `row-${i}`}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          contentContainerStyle={{ paddingBottom: 120 }}
          ListHeaderComponent={
            // Render as JSX directly — not a new component reference each render.
            // StaticHeader is memo so its entering animation only fires on mount.
            <>
              <StaticHeader
                insetTop={insets.top}
                categories={categories}
                featuredProducts={featuredProducts}
                selectedCategory={selectedCategory}
                itemCount={itemCount}
                onGoToCart={goToCart}
                onGoToSearch={goToSearch}
                onGoToOrders={goToOrders}
                onCategoryPress={loadByCategory}
                onProductPress={handleProductPress}
              />
              <DynamicSection
                selectedCategory={selectedCategory}
                categories={categories}
                pagination={pagination}
                sortBy={sortBy}
                isProductsPending={isProductsPending}
                onSortChange={setSortBy}
              />
            </>
          }
          ItemSeparatorComponent={() => <View style={{ height: COLUMN_GAP }} />}
          ListFooterComponent={() =>
            isProductsPending && products.length > 0 ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={() =>
            !isLoading && !isProductsPending ? (
              <Animated.View entering={FadeInUp.duration(350)} style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: withOpacity(colors.primary, 0.1), borderRadius: 999 }]}>
                  <Icon name="ShoppingBag" size={36} color={colors.primary} />
                </View>
                <AppText variant="title3" weight="semiBold" style={{ marginTop: 16 }}>No products found</AppText>
                <AppText variant="body" secondary align="center" style={{ marginTop: 8 }}>
                  Try a different category or search term.
                </AppText>
              </Animated.View>
            ) : null
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.35}
          renderItem={({ item: row }) => (
            <View style={[styles.row, { paddingHorizontal: 16, gap: COLUMN_GAP }]}>
              {row.map((product, idx) => (
                <ProductCard key={product._id} product={product} index={idx} onPress={handleProductPress} />
              ))}
              {row.length === 1 && <View style={{ width: CARD_WIDTH }} />}
            </View>
          )}
        />
      )}
    </View>
  );
};

export default ShopScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'flex-start', paddingBottom: 4 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, position: 'relative',
  },
  cartBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
  },
  searchKbd: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seeAllBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 2,
  },
  sortPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  row: { flexDirection: 'row' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyIcon: { width: 72, height: 72, justifyContent: 'center', alignItems: 'center' },
});
