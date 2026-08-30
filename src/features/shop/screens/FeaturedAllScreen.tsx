// ─── FeaturedAllScreen.tsx ─────────────────────────────────────────────────────
// Shows all featured products in a modern grid layout with pull-to-refresh.

import React, { memo, useCallback } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../../hooks/useTheme';
import { AppText, Header, Screen } from '../../../components';
import { Icon } from '../../../components/Icon';
import { withOpacity } from '../../../utils/withOpacity';
import { useFeaturedProducts } from '../hooks/useShop';
import { RootRoutes, ShopRoutes } from '../../../navigation/routes';
import type { RootStackParamList } from '../../../types/navigation.types';
import type { Product } from '../types/shop.types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_GAP = 12;
const H_PADDING = 16;
const CARD_WIDTH = (SCREEN_WIDTH - H_PADDING * 2 - COLUMN_GAP) / 2;
const IMAGE_HEIGHT = 140;

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ─── Featured Product Card ────────────────────────────────────────────────────

interface CardProps {
  product: Product;
  index: number;
  onPress: (product: Product) => void;
}

const FeaturedProductCard = memo(({ product, index, onPress }: CardProps) => {
  const { colors, radius } = useTheme();

  const hasDiscount = product.discountedPrice != null && product.discountedPrice < product.price;
  const displayPrice = hasDiscount ? product.discountedPrice! : product.price;
  const coinPrice = Math.round(displayPrice * 10);
  const originalCoinPrice = Math.round(product.price * 10);
  const discountPct = hasDiscount
    ? Math.round(((product.price - product.discountedPrice!) / product.price) * 100)
    : 0;

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(350)} style={{ width: CARD_WIDTH }}>
      <Pressable
        onPress={() => onPress(product)}
        style={[
          styles.card,
          {
            borderRadius: radius.xl,
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        {/* Image */}
        <View style={[styles.imageWrap, { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: withOpacity(product.category.color, 0.06) }]}>
          <Image
            source={{ uri: product.images?.[0] }}
            style={styles.image}
            resizeMode="cover"
            resizeMethod="resize"
          />

          {/* Discount badge */}
          {hasDiscount && (
            <View style={[styles.discBadge, { backgroundColor: '#EF4444' }]}>
              <AppText variant="caption2" weight="bold" color="#fff">-{discountPct}%</AppText>
            </View>
          )}

          {/* Featured star */}
          <View style={[styles.featuredBadge, { backgroundColor: withOpacity('#F59E0B', 0.9) }]}>
            <Icon name="Star" size={10} color="#fff" filled />
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>
          {/* Category pill */}
          <View style={[styles.catPill, { backgroundColor: withOpacity(product.category.color, 0.1) }]}>
            <AppText variant="caption2" weight="bold" color={product.category.color}>
              {product.category.name}
            </AppText>
          </View>

          {/* Name */}
          <AppText variant="subhead" weight="semiBold" numberOfLines={2} style={{ marginTop: 6, lineHeight: 18 }}>
            {product.name}
          </AppText>

          {/* Rating */}
          <View style={styles.ratingRow}>
            <Icon name="Star" size={11} color="#F59E0B" filled />
            <AppText variant="caption2" weight="semiBold" style={{ marginLeft: 3 }}>
              {product.rating.toFixed(1)}
            </AppText>
            <AppText variant="caption2" secondary style={{ marginLeft: 2 }}>
              ({product.reviewCount})
            </AppText>
          </View>

          {/* Price */}
          <View style={styles.priceRow}>
            <Icon name="Coins" size={13} color="#B45309" />
            <AppText variant="subhead" weight="bold" color="#92400E" style={{ marginLeft: 4 }}>
              {coinPrice.toLocaleString()}
            </AppText>
            {hasDiscount && (
              <AppText variant="caption2" color="#B45309" style={styles.strike}>
                {originalCoinPrice.toLocaleString()}
              </AppText>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

FeaturedProductCard.displayName = 'FeaturedProductCard';

// ─── Main Screen ──────────────────────────────────────────────────────────────

const FeaturedAllScreen = memo(() => {
  const { colors } = useTheme();
  const navigation = useNavigation<NavProp>();
  const { data: featuredProducts = [], isLoading, isRefetching, refetch } = useFeaturedProducts();

  const handleProductPress = useCallback((product: Product) => {
    navigation.navigate(RootRoutes.SHOP_NAVIGATOR, {
      screen: ShopRoutes.PRODUCT_DETAIL,
      params: { productId: product._id },
    });
  }, [navigation]);

  const rows: Product[][] = [];
  for (let i = 0; i < featuredProducts.length; i += 2) {
    rows.push(featuredProducts.slice(i, i + 2));
  }

  return (
    <Screen
      safeArea={false}
      padded={false}
      header={<Header title="Featured Products" showBack backLabel="" bordered />}
    >
      <FlashList
        data={rows}
        keyExtractor={(_, i) => `row-${i}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: H_PADDING, paddingTop: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
        ItemSeparatorComponent={() => <View style={{ height: COLUMN_GAP }} />}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={[styles.headerIcon, { backgroundColor: withOpacity('#F59E0B', 0.1) }]}>
              <Icon name="Star" size={20} color="#F59E0B" filled />
            </View>
            <AppText variant="headline" weight="bold" style={{ marginTop: 10 }}>
              All Featured Products
            </AppText>
            <AppText variant="caption1" secondary style={{ marginTop: 4, textAlign: 'center' }}>
              Curated picks to fuel your fitness journey
            </AppText>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Icon name="ShoppingBag" size={40} color={colors.mutedForeground} />
              <AppText variant="subhead" secondary style={{ marginTop: 12 }}>
                No featured products right now
              </AppText>
            </View>
          ) : null
        }
        renderItem={({ item: row, index }) => (
          <View style={styles.row}>
            {row.map((product, idx) => (
              <FeaturedProductCard
                key={product._id}
                product={product}
                index={index * 2 + idx}
                onPress={handleProductPress}
              />
            ))}
            {row.length === 1 && <View style={{ width: CARD_WIDTH }} />}
          </View>
        )}
      />
    </Screen>
  );
});

FeaturedAllScreen.displayName = 'FeaturedAllScreen';
export default FeaturedAllScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: COLUMN_GAP,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  imageWrap: {
    width: '100%',
    height: IMAGE_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  discBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  featuredBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 10,
  },
  catPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  strike: {
    textDecorationLine: 'line-through',
    marginLeft: 5,
  },
  listHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginTop: 16,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
});
