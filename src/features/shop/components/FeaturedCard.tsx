// src/features/shop/components/FeaturedCard.tsx
import React, { memo } from 'react';
import { Image, Pressable, StyleSheet, View, Dimensions } from 'react-native';
import { useTheme } from '../../../hooks/useTheme';
import AppText from '../../../components/AppText';
import { Icon } from '../../../components/Icon';
import { withOpacity } from '../../../utils/withOpacity';
import type { Product } from '../types/shop.types';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.72;

interface Props {
  product: Product;
  index: number;
  onPress: (product: Product) => void;
}

const FeaturedCard = memo(({ product, index, onPress }: Props) => {
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

  return (
    <Pressable
      onPress={() => onPress(product)}
      style={({ pressed }) => [
        styles.card,
        {
          width: CARD_WIDTH,
          marginRight: spacing[3],
          borderRadius: radius.xl,
          backgroundColor: colors.card,
          opacity: pressed ? 0.95 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.09,
          shadowRadius: 16,
          elevation: 4,
        },
      ]}
    >
      {/* Image */}
      <View
        style={[
          styles.imageWrap,
          { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
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
              styles.discountBadge,
              { backgroundColor: colors.destructive, borderRadius: radius.sm },
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
              backgroundColor: withOpacity('#F5C518', 0.92),
              borderRadius: radius.sm,
            },
          ]}
        >
          <Icon name="Coins" size={10} color="#92400E" />
          <AppText
            variant="caption2"
            weight="bold"
            color="#92400E"
            style={{ marginLeft: 3 }}
          >
            Coins Only
          </AppText>
        </View>
      </View>

      {/* Info */}
      <View style={{ padding: spacing[3] }}>
        <AppText variant="overline" color={product.category.color}>
          {product.category.name}
        </AppText>
        <AppText
          variant="headline"
          weight="semiBold"
          style={{ marginTop: 2 }}
          numberOfLines={2}
        >
          {product.name}
        </AppText>

        {/* Rating */}
        <View style={[styles.ratingRow, { marginTop: spacing[2] }]}>
          <Icon name="Star" size={13} color="#F59E0B" />
          <AppText
            variant="caption1"
            weight="semiBold"
            style={{ marginLeft: 3 }}
          >
            {product.rating.toFixed(1)}
          </AppText>
          <AppText variant="caption2" secondary style={{ marginLeft: 4 }}>
            ({product.reviewCount})
          </AppText>
        </View>

        {/* Coin Price */}
        <View style={[styles.priceRow, { marginTop: spacing[2] }]}>
          <Icon name="Coins" size={16} color="#B45309" />
          <AppText
            variant="headline"
            weight="bold"
            color="#92400E"
            style={{ marginLeft: 5 }}
          >
            {coinPrice.toLocaleString()}
          </AppText>
          {hasDiscount && (
            <AppText variant="caption1" secondary style={styles.strikethrough}>
              {originalCoinPrice.toLocaleString()}
            </AppText>
          )}
          <AppText variant="caption2" secondary style={{ marginLeft: 2 }}>
            coins
          </AppText>
        </View>
      </View>
    </Pressable>
  );
});

FeaturedCard.displayName = 'FeaturedCard';
export default FeaturedCard;

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  imageWrap: {
    width: '100%',
    height: 170,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  image: { width: '100%', height: '100%' },
  discountBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  coinsBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  strikethrough: { textDecorationLine: 'line-through' },
});
