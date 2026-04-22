// src/features/shop/screens/ProductDetailScreen.tsx — Advanced Redesign
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp, RouteProp } from '@react-navigation/native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../hooks/useTheme';
import AppText from '../../../components/AppText';
import { Icon } from '../../../components/Icon';
import { withOpacity } from '../../../utils/withOpacity';
import { useProductDetail } from '../hooks/useShop';
import { useCart } from '../context/CartContext';
import { RootRoutes, ShopRoutes } from '../../../navigation/routes';
import type { ShopStackParamList } from '../../../types/navigation.types';
import ReviewSection from '../components/ReviewSection';

const { width: W, height: H } = Dimensions.get('window');
const HERO_H = H * 0.46;

type RoutePropT = RouteProp<ShopStackParamList, typeof ShopRoutes.PRODUCT_DETAIL>;
type NavPropT = NavigationProp<ShopStackParamList, typeof ShopRoutes.PRODUCT_DETAIL>;

// ─── Star Rating ──────────────────────────────────────────────────────────────
const StarRating = memo(({ rating }: { rating: number }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1, 2, 3, 4, 5].map(i => (
      <Icon
        key={i}
        name="Star"
        size={14}
        color={i <= Math.round(rating) ? '#F59E0B' : '#D1D5DB'}
        filled={i <= Math.round(rating)}
      />
    ))}
  </View>
));
StarRating.displayName = 'StarRating';

// ─── Quantity Stepper ─────────────────────────────────────────────────────────
const QuantityStepper = memo(({ qty, onInc, onDec }: { qty: number; onInc: () => void; onDec: () => void }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.stepper, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      <Pressable onPress={onDec} style={styles.stepBtn}>
        <Icon name="Minus" size={16} color={colors.foreground} />
      </Pressable>
      <AppText variant="headline" weight="bold" style={{ minWidth: 28, textAlign: 'center' }}>{qty}</AppText>
      <Pressable onPress={onInc} style={styles.stepBtn}>
        <Icon name="Plus" size={16} color={colors.foreground} />
      </Pressable>
    </View>
  );
});
QuantityStepper.displayName = 'QuantityStepper';

// ─── Main Screen ──────────────────────────────────────────────────────────────
const ProductDetailScreen = () => {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<RoutePropT>();
  const navigation = useNavigation<NavPropT>();
  const { productId } = route.params;
  const { addToCart, items } = useCart();
  const { mutate: getProduct, isPending, data: resData } = useProductDetail();

  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [addedAnim, setAddedAnim] = useState(false);
  const scrollY = useSharedValue(0);

  useEffect(() => { getProduct(productId); }, [productId]);

  const product = resData?.data;
  const hasDiscount = product?.discountedPrice != null && product.discountedPrice < product.price;
  const displayPrice = hasDiscount ? product?.discountedPrice ?? 0 : product?.price ?? 0;
  const originalPrice = product?.price ?? 0;
  const coinPrice = Math.max(1, Math.round(displayPrice * 10));
  const originalCoinPrice = Math.round(originalPrice * 10);
  const discountPct = hasDiscount ? Math.round(((originalPrice - displayPrice) / originalPrice) * 100) : 0;

  const inCartQty = useMemo(
    () => items.find(i => i.product._id === productId)?.quantity ?? 0,
    [items, productId],
  );

  const scrollHandler = useAnimatedScrollHandler(e => {
    scrollY.value = e.contentOffset.y;
  });

  // 0 = over hero (transparent), 1 = past hero (solid header)
  const headerProgress = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [HERO_H - 80, HERO_H - 20], [0, 1], 'clamp'),
  }));

  const handleGalleryEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActiveImg(Math.round(e.nativeEvent.contentOffset.x / W));
  };

  const handleAddToCart = useCallback(() => {
    if (!product || product.stock <= 0) return;
    addToCart(product, qty);
    setAddedAnim(true);
    setTimeout(() => setAddedAnim(false), 1800);
  }, [product, qty, addToCart]);

  const handleBuyNow = useCallback(() => {
    if (!product || product.stock <= 0) return;
    addToCart(product, qty);
    navigation.navigate(ShopRoutes.CART);
  }, [product, qty, addToCart, navigation]);

  if (isPending || !product) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <AppText variant="body" secondary style={{ marginTop: 12 }}>Loading product…</AppText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Unified header — transparent over hero, solid when scrolled ── */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, height: insets.top + 56 },
        ]}
        pointerEvents="box-none"
      >
        {/* Solid background — fades in as you scroll past the hero */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            headerProgress,
            { backgroundColor: colors.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
          ]}
          pointerEvents="none"
        />

        {/* Back button — always visible */}
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.circleBtn, { backgroundColor: withOpacity(colors.card, 0.88), borderColor: withOpacity(colors.border, 0.6) }]}
          hitSlop={8}
        >
          <Icon name="ArrowLeft" size={20} color={colors.foreground} />
        </Pressable>

        {/* Product title — fades in with the header */}
        <Animated.Text
          numberOfLines={1}
          style={[styles.headerTitle, { color: colors.foreground, flex: 1, marginHorizontal: 10 }, headerProgress]}
        >
          {product.name}
        </Animated.Text>

        {/* Cart button — always visible */}
        <Pressable
          onPress={() => navigation.navigate(ShopRoutes.CART)}
          style={[styles.circleBtn, { backgroundColor: withOpacity(colors.card, 0.88), borderColor: withOpacity(colors.border, 0.6) }]}
          hitSlop={8}
        >
          <Icon name="ShoppingCart" size={20} color={colors.foreground} />
          {inCartQty > 0 && (
            <View style={[styles.cartDot, { backgroundColor: colors.primary }]}>
              <AppText variant="caption2" weight="bold" color="#fff" style={{ fontSize: 9 }}>{inCartQty}</AppText>
            </View>
          )}
        </Pressable>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom + 12 }}
      >
        {/* Hero Gallery */}
        <View style={[styles.heroWrap, { height: HERO_H, backgroundColor: withOpacity(product.category.color, 0.07) }]}>
          <ScrollView
            horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleGalleryEnd}
          >
            {product.images.map((img: string, i: number) => (
              <Image key={i} source={{ uri: img }} style={{ width: W, height: HERO_H }} resizeMode="cover" />
            ))}
          </ScrollView>


          {/* Discount badge */}
          {hasDiscount && (
            <View style={[styles.discBadge, { top: insets.top + 64, left: 16, backgroundColor: '#EF4444' }]}>
              <AppText variant="caption1" weight="bold" color="#fff">SAVE {discountPct}%</AppText>
            </View>
          )}

          {/* Dot indicators */}
          {product.images.length > 1 && (
            <View style={styles.dots}>
              {product.images.map((_: string, i: number) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    { width: i === activeImg ? 20 : 7, backgroundColor: i === activeImg ? '#fff' : 'rgba(255,255,255,0.5)' },
                  ]}
                />
              ))}
            </View>
          )}

          {/* Thumbnail strip */}
          {product.images.length > 1 && (
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              style={styles.thumbStrip}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            >
              {product.images.map((img: string, i: number) => (
                <Pressable key={i} style={[styles.thumb, { borderColor: i === activeImg ? colors.primary : 'transparent', borderRadius: 8 }]}>
                  <Image source={{ uri: img }} style={{ width: '100%', height: '100%', borderRadius: 6 }} resizeMode="cover" />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Content card */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          style={[styles.contentCard, { backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28 }]}
        >
          {/* Category + Rating */}
          <View style={styles.rowBetween}>
            <View style={[styles.catChip, { backgroundColor: withOpacity(product.category.color, 0.12) }]}>
              <AppText variant="caption1" weight="semiBold" color={product.category.color}>{product.category.name}</AppText>
            </View>
            <View style={[styles.ratingChip, { backgroundColor: withOpacity('#F59E0B', 0.1) }]}>
              <StarRating rating={product.rating} />
              <AppText variant="caption1" weight="bold" style={{ marginLeft: 6 }}>{product.rating.toFixed(1)}</AppText>
              <AppText variant="caption2" secondary style={{ marginLeft: 4 }}>({product.reviewCount})</AppText>
            </View>
          </View>

          {/* Title */}
          <AppText variant="title1" weight="bold" style={{ marginTop: 12, lineHeight: 34 }}>
            {product.name}
          </AppText>

          {/* Tags */}
          {product.tags?.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 6 }}>
              {product.tags.map((tag: string) => (
                <View key={tag} style={[styles.tag, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <AppText variant="caption2" secondary>#{tag}</AppText>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Price block */}
          <View style={[styles.priceBlock, { backgroundColor: withOpacity('#F5C518', 0.07), borderColor: withOpacity('#F5C518', 0.3), marginTop: 18 }]}>
            <View style={styles.rowBetween}>
              <View>
                <AppText variant="caption1" secondary>Coins Price</AppText>
                <View style={styles.priceRow}>
                  <Icon name="Coins" size={24} color="#B45309" />
                  <AppText variant="title1" weight="bold" color="#92400E" style={{ marginLeft: 6 }}>{coinPrice.toLocaleString()}</AppText>
                  <AppText variant="subhead" color="#B45309" style={{ marginLeft: 4, marginTop: 6 }}>coins</AppText>
                </View>
                {hasDiscount && (
                  <AppText variant="caption1" secondary style={{ textDecorationLine: 'line-through', marginTop: 2 }}>
                    {originalCoinPrice.toLocaleString()} coins
                  </AppText>
                )}
              </View>
              {hasDiscount && (
                <View style={[styles.offBadge, { backgroundColor: withOpacity('#10B981', 0.12) }]}>
                  <AppText variant="subhead" weight="bold" color="#10B981">{discountPct}% OFF</AppText>
                </View>
              )}
            </View>
            <View style={[styles.rupeeRow, { borderTopColor: withOpacity('#F5C518', 0.3), marginTop: 10 }]}>
              <Icon name="IndianRupee" size={12} color={colors.mutedForeground} />
              <AppText variant="caption1" secondary style={{ marginLeft: 3 }}>
                Equivalent ₹{displayPrice.toLocaleString()} · 10 coins = ₹1
              </AppText>
            </View>
          </View>

          {/* Highlights */}
          <View style={[styles.highlightRow, { marginTop: 18 }]}>
            {[
              { icon: 'Star', label: 'Rating', value: product.rating.toFixed(1), color: '#F59E0B' },
              { icon: 'MessageCircle', label: 'Reviews', value: String(product.reviewCount), color: colors.primary },
              { icon: product.stock > 0 ? 'PackageCheck' : 'PackageX', label: 'Stock', value: product.stock > 0 ? `${product.stock}` : 'None', color: product.stock > 0 ? '#10B981' : '#EF4444' },
            ].map(h => (
              <View key={h.label} style={[styles.highlightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.hlIcon, { backgroundColor: withOpacity(h.color, 0.12) }]}>
                  <Icon name={h.icon as any} size={18} color={h.color} />
                </View>
                <AppText variant="caption2" secondary style={{ marginTop: 8 }}>{h.label}</AppText>
                <AppText variant="subhead" weight="bold" style={{ marginTop: 3 }}>{h.value}</AppText>
              </View>
            ))}
          </View>

          {/* Quantity */}
          <View style={[styles.qtyRow, { marginTop: 20 }]}>
            <AppText variant="headline" weight="semiBold">Quantity</AppText>
            <QuantityStepper
              qty={qty}
              onInc={() => setQty(q => Math.min(q + 1, product.stock))}
              onDec={() => setQty(q => Math.max(1, q - 1))}
            />
          </View>

          {/* Stock status */}
          <View style={[styles.stockRow, { backgroundColor: product.stock > 0 ? withOpacity('#10B981', 0.07) : withOpacity('#EF4444', 0.07), borderColor: product.stock > 0 ? withOpacity('#10B981', 0.25) : withOpacity('#EF4444', 0.25), marginTop: 16 }]}>
            <View style={[styles.stockDot, { backgroundColor: product.stock > 0 ? '#10B981' : '#EF4444' }]} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <AppText variant="subhead" weight="semiBold" color={product.stock > 0 ? '#10B981' : '#EF4444'}>
                {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
              </AppText>
              <AppText variant="caption1" secondary style={{ marginTop: 2 }}>
                {product.stock > 0 ? `${product.stock} units available` : 'Currently unavailable'}
              </AppText>
            </View>
          </View>

          {/* Description */}
          <View style={{ marginTop: 22 }}>
            <AppText variant="title3" weight="bold">About this item</AppText>
            <AppText variant="body" secondary style={{ marginTop: 10, lineHeight: 24 }}>
              {product.description}
            </AppText>
          </View>

          {/* Delivery info */}
          <View style={[styles.deliveryCard, { backgroundColor: withOpacity(colors.primary, 0.05), borderColor: withOpacity(colors.primary, 0.12), marginTop: 20 }]}>
            {[
              { icon: 'Truck', title: 'Fast Delivery', sub: 'Delivered to your door' },
              { icon: 'ShieldCheck', title: 'Secure Purchase', sub: 'Coins deducted instantly' },
              { icon: 'RotateCcw', title: 'Easy Returns', sub: 'Cancel before shipping' },
            ].map((item, i) => (
              <View key={item.icon} style={[styles.deliveryRow, i > 0 && { marginTop: 14 }]}>
                <View style={[styles.deliveryIcon, { backgroundColor: withOpacity(colors.primary, 0.12) }]}>
                  <Icon name={item.icon as any} size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <AppText variant="subhead" weight="semiBold">{item.title}</AppText>
                  <AppText variant="caption1" secondary style={{ marginTop: 2 }}>{item.sub}</AppText>
                </View>
              </View>
            ))}
          </View>

          {/* Reviews */}
          <ReviewSection
            productId={productId}
            initialRating={product.rating}
            initialReviewCount={product.reviewCount}
          />
        </Animated.View>
      </Animated.ScrollView>

      {/* Sticky bottom CTA */}
      <Animated.View
        entering={SlideInDown.delay(200).duration(400)}
        style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}
      >
        <View style={[styles.balanceHint, { backgroundColor: withOpacity('#F5C518', 0.1), borderColor: withOpacity('#F5C518', 0.3) }]}>
          <Icon name="Coins" size={14} color="#B45309" />
          <AppText variant="caption1" weight="semiBold" color="#92400E" style={{ marginLeft: 6 }}>
            {(coinPrice * qty).toLocaleString()} coins needed
          </AppText>
          <View style={{ flex: 1 }} />
          <AppText variant="caption2" color="#B45309">10 coins = ₹1</AppText>
        </View>

        <View style={styles.ctaRow}>
          <Pressable
            onPress={handleAddToCart}
            disabled={product.stock <= 0}
            style={[
              styles.addCartBtn,
              { borderColor: addedAnim ? '#10B981' : withOpacity('#92400E', 0.5), backgroundColor: addedAnim ? withOpacity('#10B981', 0.1) : withOpacity('#92400E', 0.07) },
            ]}
          >
            <Icon name={addedAnim ? 'CheckCircle2' : 'ShoppingCart'} size={18} color={addedAnim ? '#10B981' : '#92400E'} />
            <AppText variant="subhead" weight="bold" color={addedAnim ? '#10B981' : '#92400E'} style={{ marginLeft: 6 }}>
              {addedAnim ? 'Added!' : 'Add to Cart'}
            </AppText>
          </Pressable>

          <Pressable
            onPress={handleBuyNow}
            disabled={product.stock <= 0}
            style={[styles.buyBtn, { backgroundColor: product.stock <= 0 ? colors.mutedForeground : '#92400E' }]}
          >
            <Icon name="Coins" size={18} color="#FEF3C7" />
            <AppText variant="subhead" weight="bold" color="#FEF3C7" style={{ marginLeft: 6 }}>
              {product.stock <= 0 ? 'Out of Stock' : `Buy · ${(coinPrice * qty).toLocaleString()}`}
            </AppText>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
};

export default ProductDetailScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Unified header ──────────────────────────────────────────────────────────
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 60,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  cartDot: {
    position: 'absolute', top: -3, right: -3,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },

  heroWrap: { width: '100%', overflow: 'hidden' },
  discBadge: { position: 'absolute', zIndex: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  dots: { position: 'absolute', bottom: 60, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { height: 7, borderRadius: 99 },
  thumbStrip: { position: 'absolute', bottom: 10 },
  thumb: { width: 48, height: 48, borderWidth: 2, borderRadius: 8 },

  contentCard: { paddingHorizontal: 16, paddingTop: 20 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  ratingChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },

  priceBlock: { borderRadius: 16, borderWidth: 1, padding: 16 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  offBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  rupeeRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingTop: 10 },

  highlightRow: { flexDirection: 'row', gap: 10 },
  highlightCard: { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, alignItems: 'center' },
  hlIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  qtyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 4 },
  stepBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },

  stockRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 14 },
  stockDot: { width: 10, height: 10, borderRadius: 5 },

  deliveryCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  deliveryRow: { flexDirection: 'row', alignItems: 'center' },
  deliveryIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  bottomBar: { position: 'absolute', bottom: 0, width: '100%', borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12 },
  balanceHint: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  ctaRow: { flexDirection: 'row', gap: 10 },
  addCartBtn: { flex: 1, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1.5 },
  buyBtn: { flex: 1.4, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
});
