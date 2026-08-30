// src/features/shop/components/ProductCard.tsx
import React, { memo, useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
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
const COLUMN_GAP = 12;
const H_PADDING = 16;
export const CARD_WIDTH = (width - H_PADDING * 2 - COLUMN_GAP) / 2;
const IMAGE_HEIGHT = 145;

interface Props {
  product: Product;
  index: number;
  onPress: (product: Product) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ─── Image Carousel (inside card) ─────────────────────────────────────────────

const CardImageCarousel = memo(({ images, cardWidth, categoryColor, borderRadius }: {
  images: string[];
  cardWidth: number;
  categoryColor: string;
  borderRadius: number;
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const hasMultiple = images.length > 1;

  const handleScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
    setActiveIndex(idx);
  }, [cardWidth]);

  return (
    <View style={[styles.imageWrap, { borderTopLeftRadius: borderRadius, borderTopRightRadius: borderRadius, backgroundColor: withOpacity(categoryColor, 0.07) }]}>
      {hasMultiple ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          scrollEventThrottle={16}
          bounces={false}
        >
          {images.map((img, i) => (
            <Image key={i} source={{ uri: img }} style={{ width: cardWidth, height: IMAGE_HEIGHT }} resizeMode="cover" resizeMethod="resize" />
          ))}
        </ScrollView>
      ) : (
        <Image source={{ uri: images[0] }} style={styles.image} resizeMode="cover" resizeMethod="resize" />
      )}

      {/* Dot indicators */}
      {hasMultiple && (
        <View style={styles.dotsRow}>
          {images.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === activeIndex ? '#fff' : 'rgba(255,255,255,0.45)',
                  width: i === activeIndex ? 12 : 5,
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
});

CardImageCarousel.displayName = 'CardImageCarousel';

// ─── Product Card ─────────────────────────────────────────────────────────────

const ProductCard = memo(({ product, index, onPress }: Props) => {
  const { colors, radius } = useTheme();
  const scale = useSharedValue(1);

  const hasDiscount = product.discountedPrice != null && product.discountedPrice < product.price;
  const displayPrice = hasDiscount ? product.discountedPrice! : product.price;
  const coinPrice = Math.round(displayPrice * 10);
  const originalCoinPrice = Math.round(product.price * 10);
  const discountPct = hasDiscount
    ? Math.round(((product.price - product.discountedPrice!) / product.price) * 100)
    : 0;
  const isOutOfStock = product.stock === 0;

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(index * 55).duration(380)} style={{ width: CARD_WIDTH }}>
      <Animated.View style={animStyle}>
        <AnimatedPressable
          onPress={() => onPress(product)}
          onPressIn={() => { scale.value = withSpring(0.96, { damping: 15 }); }}
          onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
          disabled={isOutOfStock}
          style={[
            styles.card,
            {
              borderRadius: radius.xl,
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: isOutOfStock ? 0.55 : 1,
            },
          ]}
        >
          {/* Image Carousel */}
          <View style={{ position: 'relative' }}>
            <CardImageCarousel
              images={product.images}
              cardWidth={CARD_WIDTH}
              categoryColor={product.category.color}
              borderRadius={radius.xl}
            />

            {/* Badges row */}
            <View style={styles.badgesRow}>
              {hasDiscount && (
                <View style={[styles.badge, { backgroundColor: '#EF4444' }]}>
                  <AppText variant="caption2" weight="bold" color="#fff">-{discountPct}%</AppText>
                </View>
              )}
            </View>

            {/* Coins-only pill top-right */}
            <View style={[styles.coinPill, { backgroundColor: 'rgba(245,197,24,0.92)' }]}>
              <Icon name="Coins" size={9} color="#92400E" />
              <AppText variant="caption2" weight="bold" color="#92400E" style={{ marginLeft: 2 }}>Only</AppText>
            </View>

            {/* Image count indicator */}
            {product.images.length > 1 && (
              <View style={styles.countPill}>
                <Icon name="Images" size={9} color="#fff" />
                <AppText variant="caption2" weight="bold" color="#fff" style={{ marginLeft: 2 }}>
                  {product.images.length}
                </AppText>
              </View>
            )}

            {isOutOfStock && (
              <View style={[styles.outOverlay, { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }]}>
                <AppText variant="caption1" weight="bold" color="#fff">Out of Stock</AppText>
              </View>
            )}
          </View>

          {/* Body */}
          <View style={styles.body}>
            <View style={[styles.catTag, { backgroundColor: withOpacity(product.category.color, 0.12), borderRadius: 4 }]}>
              <AppText variant="caption2" weight="semiBold" color={product.category.color}>{product.category.name}</AppText>
            </View>

            <AppText variant="subhead" weight="semiBold" style={{ marginTop: 5 }} numberOfLines={2}>
              {product.name}
            </AppText>

            <View style={styles.ratingRow}>
              <Icon name="Star" size={11} color="#F59E0B" filled />
              <AppText variant="caption2" weight="semiBold" style={{ marginLeft: 3 }}>{product.rating.toFixed(1)}</AppText>
              <AppText variant="caption2" secondary style={{ marginLeft: 3 }}>({product.reviewCount})</AppText>
            </View>

            <View style={[styles.priceRow, { marginTop: 8, backgroundColor: withOpacity('#F5C518', 0.08), borderRadius: 8, padding: 6 }]}>
              <Icon name="Coins" size={13} color="#B45309" />
              <AppText variant="label" weight="bold" color="#92400E" style={{ marginLeft: 4 }}>
                {coinPrice.toLocaleString()}
              </AppText>
              {hasDiscount && (
                <AppText variant="caption2" secondary style={[styles.strike, { marginLeft: 5 }]}>
                  {originalCoinPrice.toLocaleString()}
                </AppText>
              )}
            </View>
          </View>
        </AnimatedPressable>
      </Animated.View>
    </Animated.View>
  );
});

ProductCard.displayName = 'ProductCard';
export default ProductCard;

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  imageWrap: { width: '100%', height: IMAGE_HEIGHT, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  badgesRow: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', gap: 4 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  coinPill: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  countPill: {
    position: 'absolute', bottom: 8, right: 8,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  dotsRow: {
    position: 'absolute', bottom: 8, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 3,
  },
  dot: {
    height: 5, borderRadius: 3,
  },
  outOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  body: { padding: 10 },
  catTag: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  strike: { textDecorationLine: 'line-through' },
});
