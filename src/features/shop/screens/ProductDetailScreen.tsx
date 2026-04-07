import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { NavigationProp, RouteProp } from '@react-navigation/native';
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInDown,
} from 'react-native-reanimated';

import { useTheme } from '../../../hooks/useTheme';
import { AppView, AppText, Screen, Icon } from '../../../components';
import { useProductDetail } from '../hooks/useShop';
import { useCart } from '../context/CartContext';
import { RootRoutes, ShopRoutes } from '../../../navigation/routes';
import type { ShopStackParamList } from '../../../types/navigation.types';
import { withOpacity } from '../../../utils/withOpacity';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../../utils/measure';

const HERO_HEIGHT = SCREEN_HEIGHT * 0.48;

type ProductDetailRouteProp = RouteProp<
  ShopStackParamList,
  typeof ShopRoutes.PRODUCT_DETAIL
>;
type ProductDetailNavProp = NavigationProp<
  ShopStackParamList,
  typeof ShopRoutes.PRODUCT_DETAIL
>;

const ProductDetailScreen = () => {
  const { colors, spacing, radius, fontSize } = useTheme();
  const route = useRoute<ProductDetailRouteProp>();
  const navigation = useNavigation<ProductDetailNavProp>();

  const { productId } = route.params;
  const { addToCart } = useCart();
  const { mutate: getProduct, isPending, data: resData } = useProductDetail();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const imageScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    getProduct(productId);
  }, [getProduct, productId]);

  const product = resData?.data;

  const hasDiscount =
    product?.discountedPrice != null &&
    Number(product.discountedPrice) < Number(product.price);

  const displayPrice = hasDiscount
    ? product?.discountedPrice ?? 0
    : product?.price ?? 0;

  const originalPrice = product?.price ?? 0;
  const coinPrice = Math.max(1, Math.round(displayPrice * 10));

  const discountPercent = useMemo(() => {
    if (!hasDiscount || !originalPrice || !displayPrice) return 0;
    return Math.round(((originalPrice - displayPrice) / originalPrice) * 100);
  }, [hasDiscount, originalPrice, displayPrice]);

  const highlights = useMemo(() => {
    if (!product) return [];

    return [
      {
        id: 'rating',
        icon: 'Star',
        label: 'Rating',
        value: `${product.rating.toFixed(1)}`,
        tint: '#F59E0B',
      },
      {
        id: 'reviews',
        icon: 'MessageCircleMore',
        label: 'Reviews',
        value: `${product.reviewCount}`,
        tint: colors.primary,
      },
      {
        id: 'stock',
        icon: product.stock > 0 ? 'PackageCheck' : 'PackageX',
        label: 'Availability',
        value: product.stock > 0 ? `${product.stock} left` : 'Out of stock',
        tint: product.stock > 0 ? colors.success : colors.destructive,
      },
    ];
  }, [product, colors.primary, colors.success, colors.destructive]);

  const handleGalleryScrollEnd = (
    e: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveImageIndex(index);
  };

  const handleBuyWithCoins = () => {
    if (!product || product.stock <= 0) return;
    addToCart(product, 1);
    navigation.navigate(ShopRoutes.CART, { preSelectCoins: true });
  };

  if (isPending || !product) {
    return (
      <Screen padded={false} safeArea={true}>
        <View
          style={[styles.loaderWrap, { backgroundColor: colors.background }]}
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText variant="body" secondary style={{ marginTop: spacing[3] }}>
            Loading product...
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <AppView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 130 }}
        >
          {/* Hero Gallery */}
          <Animated.View
            entering={FadeIn.duration(350)}
            style={[
              styles.heroWrap,
              {
                height: HERO_HEIGHT,
                backgroundColor: withOpacity(product.category.color, 0.07),
              },
            ]}
          >
            <View
              style={[
                styles.topActions,
                {
                  paddingHorizontal: spacing[4],
                  paddingTop: spacing[8],
                },
              ]}
            >
              <Pressable
                onPress={() => navigation.goBack()}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: withOpacity(colors.card, 0.82),
                    borderColor: withOpacity(colors.border, 0.7),
                  },
                ]}
              >
                <Icon name="ArrowLeft" size={22} color={colors.foreground} />
              </Pressable>

              <View style={styles.topRightActions}>
                <Pressable
                  onPress={() => navigation.navigate(ShopRoutes.CART)}
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: withOpacity(colors.card, 0.82),
                      borderColor: withOpacity(colors.border, 0.7),
                    },
                  ]}
                >
                  <Icon
                    name="ShoppingCart"
                    size={22}
                    color={colors.foreground}
                  />
                </Pressable>
              </View>
            </View>

            {hasDiscount ? (
              <View
                style={[
                  styles.discountBadge,
                  {
                    top: spacing[16],
                    left: spacing[4],
                    backgroundColor: colors.destructive,
                    borderRadius: radius.lg,
                  },
                ]}
              >
                <AppText variant="caption1" weight="bold" color="#fff">
                  SAVE {discountPercent}%
                </AppText>
              </View>
            ) : null}

            <ScrollView
              ref={imageScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleGalleryScrollEnd}
            >
              {product.images.map((img: string, index: number) => (
                <AppView
                  key={`${img}-${index}`}
                  style={{ width: SCREEN_WIDTH, height: HERO_HEIGHT }}
                >
                  <Image
                    source={{ uri: img }}
                    resizeMode="cover"
                    style={styles.heroImage}
                  />
                </AppView>
              ))}
            </ScrollView>

            <View style={styles.imageIndicators}>
              {product.images.map((_: string, index: number) => {
                const isActive = index === activeImageIndex;
                return (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      {
                        width: isActive ? 22 : 8,
                        backgroundColor: isActive
                          ? colors.primary
                          : withOpacity('#FFFFFF', 0.65),
                      },
                    ]}
                  />
                );
              })}
            </View>
          </Animated.View>

          {/* Content */}
          <Animated.View
            entering={FadeInDown.delay(120).duration(400)}
            style={[
              styles.contentCard,
              {
                marginTop: -28,
                backgroundColor: colors.card,
                borderTopLeftRadius: radius['3xl'],
                borderTopRightRadius: radius['3xl'],
                paddingHorizontal: spacing[4],
                paddingTop: spacing[5],
                paddingBottom: spacing[6],
              },
            ]}
          >
            {/* Category + Rating */}
            <View style={styles.rowBetween}>
              <View
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: withOpacity(product.category.color, 0.12),
                    borderRadius: radius.md,
                  },
                ]}
              >
                <AppText
                  variant="caption1"
                  weight="semiBold"
                  color={product.category.color}
                >
                  {product.category.name}
                </AppText>
              </View>

              <View
                style={[
                  styles.ratingChip,
                  {
                    backgroundColor: withOpacity(colors.primary, 0.08),
                    borderRadius: radius.md,
                  },
                ]}
              >
                <Icon name="Star" size={15} color="#F59E0B" />
                <AppText
                  variant="subhead"
                  weight="bold"
                  style={{ marginLeft: 6 }}
                >
                  {product.rating.toFixed(1)}
                </AppText>
                <AppText variant="caption1" secondary style={{ marginLeft: 4 }}>
                  ({product.reviewCount})
                </AppText>
              </View>
            </View>

            {/* Title */}
            <AppText
              variant="title1"
              weight="bold"
              style={{ marginTop: spacing[3], lineHeight: 34 }}
            >
              {product.name}
            </AppText>

            {/* Price Block */}
            <View
              style={[
                styles.priceCard,
                {
                  marginTop: spacing[4],
                  borderRadius: radius.xl,
                  backgroundColor: withOpacity('#F5C518', 0.07),
                  borderColor: withOpacity('#F5C518', 0.25),
                  padding: spacing[4],
                },
              ]}
            >
              <View style={styles.rowBetween}>
                <View>
                  <AppText variant="caption1" secondary>
                    Coins Price
                  </AppText>
                  <View style={[styles.priceRow, { marginTop: spacing[1] }]}>
                    <Icon name="Coins" size={22} color="#B45309" />
                    <AppText
                      variant="title2"
                      weight="bold"
                      color="#92400E"
                      style={{ marginLeft: 6 }}
                    >
                      {coinPrice.toLocaleString()}
                    </AppText>
                    <AppText
                      variant="caption1"
                      color="#B45309"
                      style={{ marginLeft: 4, marginTop: 4 }}
                    >
                      coins
                    </AppText>
                  </View>
                  {hasDiscount ? (
                    <AppText
                      variant="caption1"
                      secondary
                      style={{
                        marginTop: spacing[1],
                        textDecorationLine: 'line-through',
                      }}
                    >
                      {Math.round(originalPrice * 10).toLocaleString()} coins
                    </AppText>
                  ) : null}
                </View>

                {hasDiscount ? (
                  <View
                    style={[
                      styles.offPill,
                      {
                        backgroundColor: withOpacity(colors.success, 0.12),
                        borderRadius: radius.full ?? 999,
                      },
                    ]}
                  >
                    <AppText
                      variant="caption1"
                      weight="bold"
                      color={colors.success}
                    >
                      {discountPercent}% OFF
                    </AppText>
                  </View>
                ) : null}
              </View>

              {/* ₹ reference price */}
              <View
                style={[
                  styles.rupeeRef,
                  {
                    marginTop: spacing[2],
                    paddingTop: spacing[2],
                    borderTopWidth: 1,
                    borderTopColor: withOpacity('#F5C518', 0.3),
                  },
                ]}
              >
                <Icon
                  name="IndianRupee"
                  size={12}
                  color={colors.mutedForeground}
                />
                <AppText variant="caption1" secondary style={{ marginLeft: 2 }}>
                  Equivalent: ₹{displayPrice.toLocaleString()} · 10 coins = ₹1
                </AppText>
              </View>
            </View>

            {/* Quick Highlights */}
            <View style={[styles.highlightRow, { marginTop: spacing[4] }]}>
              {highlights.map(item => (
                <View
                  key={item.id}
                  style={[
                    styles.highlightCard,
                    {
                      backgroundColor: colors.background,
                      borderColor: withOpacity(colors.border, 0.8),
                      borderRadius: radius.xl,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.highlightIcon,
                      { backgroundColor: withOpacity(item.tint, 0.12) },
                    ]}
                  >
                    <Icon name={item.icon as any} size={18} color={item.tint} />
                  </View>

                  <AppText
                    variant="caption1"
                    secondary
                    style={{ marginTop: spacing[2] }}
                  >
                    {item.label}
                  </AppText>

                  <AppText
                    variant="subhead"
                    weight="bold"
                    style={{ marginTop: 4, textAlign: 'center' }}
                  >
                    {item.value}
                  </AppText>
                </View>
              ))}
            </View>

            {/* Stock Section */}
            <View
              style={[
                styles.statusRow,
                {
                  marginTop: spacing[5],
                  padding: spacing[4],
                  borderRadius: radius.xl,
                  backgroundColor: colors.background,
                  borderColor: withOpacity(colors.border, 0.8),
                },
              ]}
            >
              <View style={styles.statusLeft}>
                <View
                  style={[
                    styles.stockDot,
                    {
                      backgroundColor:
                        product.stock > 0 ? colors.success : colors.destructive,
                    },
                  ]}
                />
                <View>
                  <AppText variant="subhead" weight="semiBold">
                    {product.stock > 0
                      ? 'Available in stock'
                      : 'Currently unavailable'}
                  </AppText>
                  <AppText
                    variant="caption1"
                    secondary
                    style={{ marginTop: 2 }}
                  >
                    {product.stock > 0
                      ? `${product.stock} units ready for order`
                      : 'This product is temporarily unavailable'}
                  </AppText>
                </View>
              </View>
            </View>

            {/* Description */}
            <View style={{ marginTop: spacing[5] }}>
              <AppText variant="title3" weight="semiBold">
                About this item
              </AppText>
              <AppText
                variant="body"
                secondary
                style={{
                  marginTop: spacing[2],
                  lineHeight: 24,
                  fontSize: fontSize?.md ?? 15,
                }}
              >
                {product.description}
              </AppText>
            </View>

            {/* Extra section */}
            <View
              style={[
                styles.deliveryCard,
                {
                  marginTop: spacing[5],
                  borderRadius: radius.xl,
                  backgroundColor: withOpacity(colors.primary, 0.05),
                  borderColor: withOpacity(colors.primary, 0.1),
                  padding: spacing[4],
                },
              ]}
            >
              <View style={styles.deliveryRow}>
                <View
                  style={[
                    styles.deliveryIcon,
                    {
                      backgroundColor: withOpacity(colors.primary, 0.12),
                    },
                  ]}
                >
                  <Icon name="Truck" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="subhead" weight="semiBold">
                    Fast delivery available
                  </AppText>
                  <AppText
                    variant="caption1"
                    secondary
                    style={{ marginTop: 4 }}
                  >
                    Smooth checkout, easy cart flow, and coin-based shopping
                    support.
                  </AppText>
                </View>
              </View>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Sticky Bottom CTA — Coins Only */}
        <Animated.View
          entering={SlideInDown.delay(250).duration(450)}
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.card,
              borderTopColor: withOpacity(colors.border, 0.9),
            },
          ]}
        >
          <View
            style={[
              styles.bottomInner,
              {
                paddingHorizontal: spacing[4],
                paddingTop: spacing[3],
                paddingBottom: spacing[6],
              },
            ]}
          >
            {/* Coin balance hint */}
            <View
              style={[
                styles.balanceHint,
                {
                  backgroundColor: withOpacity('#F5C518', 0.1),
                  borderRadius: radius.lg,
                  marginBottom: spacing[3],
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                },
              ]}
            >
              <Icon name="Coins" size={14} color="#B45309" />
              <AppText
                variant="caption1"
                weight="semiBold"
                color="#92400E"
                style={{ marginLeft: 6 }}
              >
                {coinPrice.toLocaleString()} coins needed
              </AppText>
              <View style={{ flex: 1 }} />
              <AppText variant="caption2" color="#B45309">
                10 coins = ₹1
              </AppText>
            </View>

            {/* Full-width Buy button */}
            <Pressable
              disabled={product.stock <= 0}
              onPress={handleBuyWithCoins}
              style={[
                styles.buyButton,
                {
                  borderRadius: radius.xl,
                  backgroundColor:
                    product.stock <= 0 ? colors.mutedForeground : '#92400E',
                },
              ]}
            >
              <Icon name="Coins" size={20} color="#FEF3C7" />
              <AppText
                variant="body"
                weight="bold"
                color="#FEF3C7"
                style={{ marginLeft: 8 }}
              >
                {product.stock <= 0
                  ? 'Out of Stock'
                  : `Buy with ${coinPrice.toLocaleString()} Coins`}
              </AppText>
            </Pressable>
          </View>
        </Animated.View>
      </AppView>
    </Screen>
  );
};

export default ProductDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  heroWrap: {
    width: '100%',
    position: 'relative',
  },

  heroImage: {
    width: '100%',
    height: '100%',
  },

  topActions: {
    position: 'absolute',
    top: 0,
    zIndex: 20,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  topRightActions: {
    flexDirection: 'row',
    gap: 10,
  },

  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },

  discountBadge: {
    position: 'absolute',
    zIndex: 15,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  imageIndicators: {
    position: 'absolute',
    bottom: 24,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },

  dot: {
    height: 8,
    borderRadius: 99,
  },

  contentCard: {},

  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  priceCard: {
    borderWidth: 1,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  offPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  rupeeRef: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  coinEarnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  coinInfoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  highlightRow: {
    flexDirection: 'row',
    gap: 10,
  },

  highlightCard: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
  },

  highlightIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  statusRow: {
    borderWidth: 1,
  },

  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  stockDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },

  deliveryCard: {
    borderWidth: 1,
  },

  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  deliveryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    borderTopWidth: 1,
  },

  bottomInner: {},

  balanceHint: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  buyButton: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
