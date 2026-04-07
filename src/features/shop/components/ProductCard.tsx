// src/features/shop/components/ProductCard.tsx
import React, { memo } from 'react';
import { Image, Pressable, StyleSheet, View, Dimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../../hooks/useTheme';
import AppText from '../../../components/AppText';
import { Icon } from '../../../components/Icon';
import { withOpacity } from '../../../utils/withOpacity';
import type { Product } from '../types/shop.types';

const { width } = Dimensions.get('window');
const COLUMN_GAP = 12;
const H_PADDING = 16;
export const CARD_WIDTH = (width - H_PADDING * 2 - COLUMN_GAP) / 2;

interface Props {
  product: Product;
  index: number;
  onPress: (product: Product) => void;
}

const ProductCard = memo(({ product, index, onPress }: Props) => {
  const { colors, spacing, radius } = useTheme();

  const hasDiscount =
    product.discountedPrice !== null && product.discountedPrice !== undefined;
  const displayPrice = hasDiscount ? product.discountedPrice! : product.price;
  const coinPrice = Math.round(displayPrice * 10);
  const originalCoinPrice = Math.round(product.price * 10);

  const discountPct = hasDiscount
    ? Math.round(
        ((product.price - product.discountedPrice!) / product.price) * 100,
      )
    : 0;

  const isOutOfStock = product.stock === 0;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(400)}
      style={{ width: CARD_WIDTH }}
    >
      <Pressable
        onPress={() => onPress(product)}
        disabled={isOutOfStock}
        style={({ pressed }) => [
          styles.card,
          {
            borderRadius: radius.xl,
            backgroundColor: colors.card,
            opacity: pressed ? 0.93 : isOutOfStock ? 0.55 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.07,
            shadowRadius: 12,
            elevation: 3,
          },
        ]}
      >
        {/* Image */}
        <View
          style={[
            styles.imageWrap,
            {
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              backgroundColor: withOpacity(product.category.color, 0.06),
            },
          ]}
        >
          <Image
            source={{ uri: product.images[0] }}
            style={styles.image}
            resizeMode="cover"
          />

          {/* Discount badge */}
          {hasDiscount && (
            <View
              style={[
                styles.badge,
                {
                  top: 8,
                  left: 8,
                  backgroundColor: colors.destructive,
                  borderRadius: radius.xs,
                },
              ]}
            >
              <AppText variant="caption2" weight="bold" color="#fff">
                -{discountPct}%
              </AppText>
            </View>
          )}

          {/* Coins-only badge */}
          <View
            style={[
              styles.coinsBadge,
              {
                top: 8,
                right: 8,
                backgroundColor: withOpacity('#F5C518', 0.92),
                borderRadius: radius.xs,
              },
            ]}
          >
            <Icon name="Coins" size={9} color="#92400E" />
            <AppText
              variant="caption2"
              weight="bold"
              color="#92400E"
              style={{ marginLeft: 3 }}
            >
              Only
            </AppText>
          </View>

          {/* Out of stock overlay */}
          {isOutOfStock && (
            <View style={[styles.outOfStockOverlay, { borderRadius: radius.xl }]}>
              <AppText variant="caption1" weight="semiBold" color="#fff">
                Out of Stock
              </AppText>
            </View>
          )}
        </View>

        {/* Body */}
        <View style={{ padding: spacing[3] }}>
          {/* Category tag */}
          <View
            style={[
              styles.categoryTag,
              {
                backgroundColor: withOpacity(product.category.color, 0.12),
                borderRadius: radius.xs,
              },
            ]}
          >
            <AppText variant="caption2" weight="semiBold" color={product.category.color}>
              {product.category.name}
            </AppText>
          </View>

          {/* Name */}
          <AppText
            variant="subhead"
            weight="semiBold"
            style={{ marginTop: spacing[1] }}
            numberOfLines={2}
          >
            {product.name}
          </AppText>

          {/* Rating row */}
          <View style={[styles.ratingRow, { marginTop: spacing[1] }]}>
            <Icon name="Star" size={11} color="#F59E0B" />
            <AppText variant="caption2" weight="semiBold" style={{ marginLeft: 3 }}>
              {product.rating.toFixed(1)}
            </AppText>
            <AppText variant="caption2" secondary style={{ marginLeft: 3 }}>
              ({product.reviewCount})
            </AppText>
          </View>

          {/* Coin price row */}
          <View style={[styles.priceRow, { marginTop: spacing[2] }]}>
            <Icon name="Coins" size={13} color="#B45309" />
            <AppText
              variant="label"
              weight="bold"
              color="#92400E"
              style={{ marginLeft: 4 }}
            >
              {coinPrice.toLocaleString()}
            </AppText>
            {hasDiscount && (
              <AppText variant="caption2" secondary style={styles.strikethrough}>
                {originalCoinPrice.toLocaleString()}
              </AppText>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

ProductCard.displayName = 'ProductCard';
export default ProductCard;

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  imageWrap: { width: '100%', height: 140, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  coinsBadge: {
    position: 'absolute',
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  strikethrough: { textDecorationLine: 'line-through' },
});
