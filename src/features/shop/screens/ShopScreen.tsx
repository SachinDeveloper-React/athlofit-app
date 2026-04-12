import React, { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../types/navigation.types';
import {
  HealthRoutes,
  RootRoutes,
  ShopRoutes,
} from '../../../navigation/routes';
import { useTheme } from '../../../hooks/useTheme';
import AppView from '../../../components/AppView';
import AppText from '../../../components/AppText';
import Screen from '../../../components/Screen';
import { Icon } from '../../../components/Icon';
import { withOpacity } from '../../../utils/withOpacity';
import { useShopState } from '../hooks/useShop';
import CategoryPill from '../components/CategoryPill';
import FeaturedCard from '../components/FeaturedCard';
import ProductCard, { CARD_WIDTH } from '../components/ProductCard';
import type { Product } from '../types/shop.types';
import { Header, IconButton } from '../../../components';
import { SCREEN_WIDTH } from '../../../utils/measure';
import { useGamificationStore } from '../../health/store/gamificationStore';
import { formatCoins } from '../../../config/appConfig';
import { CoinBadge } from '../../health/components/tracker/RightTrackerHeader';

const COLUMN_GAP = 12;

type ShopNavProp = NativeStackNavigationProp<RootStackParamList>;

const ShopScreen = () => {
  const { colors, spacing, radius, fontSize } = useTheme();
  const navigation = useNavigation<ShopNavProp>();

  // Live coin balance
  const coinsBalance = useGamificationStore(s => s.coinsBalance);

  const {
    categories,
    featuredProducts,
    products,
    pagination,
    selectedCategory,
    isLoading,
    isRefreshing,
    isProductsPending,
    loadInitialData,
    loadByCategory,
    loadMore,
    onRefresh,
  } = useShopState();

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleProductPress = useCallback(
    (product: Product) => {
      navigation.navigate(RootRoutes.SHOP_NAVIGATOR, {
        screen: ShopRoutes.PRODUCT_DETAIL,
        params: { productId: product._id },
      });
    },
    [navigation],
  );

  // ─── Header ───────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <>
      {/* Search bar button */}
      <Pressable
        onPress={() =>
          navigation.navigate(RootRoutes.SHOP_NAVIGATOR, {
            screen: ShopRoutes.SHOP_SEARCH,
          })
        }
        style={[
          styles.searchBar,
          {
            backgroundColor: colors.secondary,
            borderRadius: radius.xl,
            marginHorizontal: spacing[4],
            marginBottom: spacing[4],
            borderWidth: 1.5,
            borderColor: 'transparent',
          },
        ]}
      >
        <Icon name="Search" size={18} color={colors.mutedForeground} />
        <AppText
          secondary
          style={{
            flex: 1,
            color: colors.mutedForeground,
            fontSize: fontSize.md,
          }}
        >
          Search supplements, gear…
        </AppText>
      </Pressable>

      {/* Categories horizontal scroll */}
      <AppView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing[4],
            paddingBottom: spacing[1],
          }}
        >
          {categories.map(cat => (
            <CategoryPill
              key={cat.slug}
              category={cat}
              isSelected={selectedCategory === cat.slug}
              onPress={loadByCategory}
            />
          ))}
        </ScrollView>
      </AppView>

      {/* Featured section */}
      {featuredProducts.length > 0 && (
        <AppView style={{ marginTop: spacing[5] }}>
          <View
            style={[
              styles.sectionHeader,
              { paddingHorizontal: spacing[4], marginBottom: spacing[3] },
            ]}
          >
            <View>
              <AppText variant="title3" weight="semiBold">
                Featured
              </AppText>
              <AppText variant="caption1" secondary style={{ marginTop: 2 }}>
                Hand-picked for your goals
              </AppText>
            </View>
            <Pressable
              style={[
                styles.seeAllBtn,
                { borderRadius: radius.full, borderColor: colors.border },
              ]}
            >
              <AppText
                variant="caption1"
                color={colors.primary}
                weight="semiBold"
              >
                See all
              </AppText>
              <Icon name="ChevronRight" size={13} color={colors.primary} />
            </Pressable>
          </View>

          <FlatList
            data={featuredProducts}
            keyExtractor={item => item._id}
            renderItem={({ item, index }) => (
              <FeaturedCard
                product={item}
                index={index}
                onPress={handleProductPress}
              />
            )}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingLeft: spacing[4],
              paddingRight: spacing[2],
              paddingBottom: spacing[2],
            }}
            snapToInterval={SCREEN_WIDTH * 0.72 + spacing[3]}
            decelerationRate="fast"
          />
        </AppView>
      )}

      {/* All Products header */}
      <AppView
        style={[
          styles.sectionHeader,
          {
            paddingHorizontal: spacing[4],
            marginTop: spacing[5],
            marginBottom: spacing[3],
          },
        ]}
      >
        <View>
          <AppText variant="title3" weight="semiBold">
            {selectedCategory === 'all'
              ? 'All Products'
              : categories.find(c => c.slug === selectedCategory)?.name ??
                'Products'}
          </AppText>
          {pagination && (
            <AppText variant="caption1" secondary style={{ marginTop: 2 }}>
              {pagination.total} item{pagination.total !== 1 ? 's' : ''}
            </AppText>
          )}
        </View>
      </AppView>
    </>
  );

  // ─── Product Grid ──────────────────────────────────────────────────────────
  const renderGridItem = useCallback(
    ({ item, index }: { item: Product; index: number }) => (
      <ProductCard product={item} index={index} onPress={handleProductPress} />
    ),
    [handleProductPress],
  );

  const renderSeparator = () => <View style={{ height: COLUMN_GAP }} />;

  const renderFooter = () => {
    if (!isProductsPending || products.length === 0) return null;
    return (
      <View style={{ paddingVertical: spacing[6], alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <AppView style={[styles.emptyState, { paddingHorizontal: spacing[6] }]}>
        <View
          style={[
            styles.emptyIcon,
            {
              backgroundColor: withOpacity(colors.primary, 0.1),
              borderRadius: radius.full,
            },
          ]}
        >
          <Icon name="ShoppingBag" size={36} color={colors.primary} />
        </View>
        <AppText
          variant="title3"
          weight="semiBold"
          style={{ marginTop: spacing[4] }}
        >
          No products found
        </AppText>
        <AppText
          variant="body"
          secondary
          align="center"
          style={{ marginTop: spacing[2] }}
        >
          Try selecting a different category or adjust your search.
        </AppText>
      </AppView>
    );
  };

  // Pair products into rows of 2 for the vertical grid
  const rows: Product[][] = [];
  for (let i = 0; i < products.length; i += 2) {
    rows.push(products.slice(i, i + 2));
  }

  return (
    <Screen padded={false} safeArea={false}>
      <AppView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {/* Static top header */}
        <AppView style={styles.topHeader}>
          <Header
            title="Shop"
            subtitle="Coins-only store"
            rightAction={
              <AppView style={styles.headerRight}>
                {/* Live coin balance chip */}
                <CoinBadge />

                <IconButton
                  name="ShoppingCart"
                  onPress={() =>
                    navigation.navigate(RootRoutes.SHOP_NAVIGATOR, {
                      screen: ShopRoutes.CART,
                    })
                  }
                  borderRadius={radius.xl}
                  borderColor={colors.border}
                />
              </AppView>
            }
          />
        </AppView>

        {/* Main list */}
        {isLoading && products.length === 0 ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={colors.primary} />
            <AppText variant="body" secondary style={{ marginTop: spacing[3] }}>
              Loading shop…
            </AppText>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(_, i) => `row-${i}`}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            contentContainerStyle={{
              paddingBottom: 120,
              marginTop: 10,
            }}
            ListHeaderComponent={renderHeader}
            ItemSeparatorComponent={renderSeparator}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={renderEmpty}
            onEndReached={loadMore}
            onEndReachedThreshold={0.35}
            renderItem={({ item: row }) => (
              <View
                style={[
                  styles.row,
                  { paddingHorizontal: spacing[4], gap: COLUMN_GAP },
                ]}
              >
                {row.map((product, idx) => (
                  <ProductCard
                    key={product._id}
                    product={product}
                    index={idx}
                    onPress={handleProductPress}
                  />
                ))}
                {/* Placeholder for odd count */}
                {row.length === 1 && <View style={{ width: CARD_WIDTH }} />}
              </View>
            )}
          />
        )}
      </AppView>
    </Screen>
  );
};

export default ShopScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    padding: 0,
    margin: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  coinEmoji: {
    fontSize: 13,
    lineHeight: 16,
  },
  coinCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
    letterSpacing: 0.3,
  },
});
