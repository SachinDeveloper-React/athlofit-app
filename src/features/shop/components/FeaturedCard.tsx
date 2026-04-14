// src/features/shop/components/FeaturedCard.tsx
import React, { memo } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../../hooks/useTheme';
import AppText from '../../../components/AppText';
import { Icon } from '../../../components/Icon';
import { withOpacity } from '../../../utils/withOpacity';
import type { Product } from '../types/shop.types';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.74;
const CARD_HEIGHT = 200;

interface Props {
  product: Product;
  index: number;
  onPress: (product: Product) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const FeaturedCard = memo(({ product, index, onPress }: Props) => {
  const { colors, radius } = useTheme();
  const scale = useSharedValue(1);

  const hasDiscount = product.discountedPrice != null && product.discountedPrice < product.price;
  const displayPrice = hasDiscount ? product.discountedPrice! : product.price;
  const coinPrice = Math.round(displayPrice * 10);
  const originalCoinPrice = Math.round(product.price * 10);
  const discountPct = hasDiscount
    ? Math.round(((product.price - product.discountedPrice!) / product.price) * 100)
    : 0;

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 80).duration(400)}
      style={[animStyle, { width: CARD_WIDTH, marginRight: 12 }]}
    >
      <AnimatedPressable
        onPress={() => onPress(product)}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        style={[styles.card, { borderRadius: radius.xl, height: CARD_HEIGHT }]}
      >
        {/* Background image */}
        <Image source={{ uri: product.images[0] }} style={styles.bgImage} resizeMode="cover" />

        {/* Gradient overlay */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0)', top: '40%' }]}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' }} />
        </View>

        {/* Top badges */}
        <View style={styles.topRow}>
          {hasDiscount && (
            <View style={[styles.discBadge, { backgroundColor: '#EF4444' }]}>
              <AppText variant="caption2" weight="bold" color="#fff">-{discountPct}%</AppText>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <View style={[styles.coinsBadge, { backgroundColor: 'rgba(245,197,24,0.92)' }]}>
            <Icon name="Coins" size={10} color="#92400E" />
            <AppText variant="caption2" weight="bold" color="#92400E" style={{ marginLeft: 3 }}>Coins Only</AppText>
          </View>
        </View>

        {/* Bottom content */}
        <View style={styles.bottomContent}>
          <View style={[styles.catChip, { backgroundColor: withOpacity(product.category.color, 0.85) }]}>
            <AppText variant="caption2" weight="bold" color="#fff">{product.category.name}</AppText>
          </View>

          <AppText variant="headline" weight="bold" color="#fff" numberOfLines={1} style={{ marginTop: 4 }}>
            {product.name}
          </AppText>

          <View style={styles.bottomRow}>
            <View style={styles.ratingRow}>
              <Icon name="Star" size={12} color="#F59E0B" filled />
              <AppText variant="caption1" weight="semiBold" color="#fff" style={{ marginLeft: 3 }}>
                {product.rating.toFixed(1)}
              </AppText>
              <AppText variant="caption2" color="rgba(255,255,255,0.65)" style={{ marginLeft: 3 }}>
                ({product.reviewCount})
              </AppText>
            </View>

            <View style={styles.priceChip}>
              <Icon name="Coins" size={13} color="#B45309" />
              <AppText variant="subhead" weight="bold" color="#92400E" style={{ marginLeft: 4 }}>
                {coinPrice.toLocaleString()}
              </AppText>
              {hasDiscount && (
                <AppText variant="caption2" color="#B45309" style={[styles.strike, { marginLeft: 4 }]}>
                  {originalCoinPrice.toLocaleString()}
                </AppText>
              )}
            </View>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
});

FeaturedCard.displayName = 'FeaturedCard';
export default FeaturedCard;

const styles = StyleSheet.create({
  card: { overflow: 'hidden', position: 'relative' },
  bgImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  topRow: {
    position: 'absolute', top: 12, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center',
  },
  discBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  coinsBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  bottomContent: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 14,
  },
  catChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  bottomRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 8,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  priceChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(245,197,24,0.92)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  strike: { textDecorationLine: 'line-through' },
});
