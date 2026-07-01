
import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import Animated, { FadeInDown, FadeInUp, Layout, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../hooks/useTheme';
import AppText from '../../../components/AppText';
import { Icon } from '../../../components/Icon';
import { withOpacity } from '../../../utils/withOpacity';
import { useCart } from '../context/CartContext';
import { useBuyWithCoins, useAddresses, useValidateCoupon, useAvailableCoupons } from '../hooks/useShop';
import { ShopRoutes } from '../../../navigation/routes';
import type { ShopStackParamList } from '../../../types/navigation.types';
import { useGamificationStore } from '../../health/store/gamificationStore';
import type { AvailableCoupon, SavedAddress, ValidateCouponResult } from '../types/shop.types';
import { Header, Screen } from '../../../components';
import { useAuthStore } from '../../auth/store/authStore';
import AlertDialog, { type AlertDialogProps } from '../../../components/AlertDialog';

type CartRouteProp = RouteProp<ShopStackParamList, typeof ShopRoutes.CART>;
const COIN_RATE = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDiscount(c: AvailableCoupon): string {
  if (c.discountType === 'percentage') {
    const cap = c.maxDiscountCoins ? ` (up to ${c.maxDiscountCoins.toLocaleString()} coins)` : '';
    return `${c.discountValue}% off${cap}`;
  }
  return `${c.discountValue.toLocaleString()} coins off`;
}

function isEligible(c: AvailableCoupon, cartTotal: number): boolean {
  return cartTotal >= c.minCartCoins;
}

// ─── CouponListSheet ──────────────────────────────────────────────────────────

interface CouponListSheetProps {
  visible: boolean;
  onClose: () => void;
  cartTotalCoins: number;
  appliedCode: string | null;
  onApply: (coupon: ValidateCouponResult) => void;
  colors: any;
  isDark: boolean;
}

const CouponListSheet = ({
  visible,
  onClose,
  cartTotalCoins,
  appliedCode,
  onApply,
  colors,
  isDark,
}: CouponListSheetProps) => {
  const { data: coupons = [], isLoading } = useAvailableCoupons();
  const { mutate: validate, isPending: isValidating, variables: validatingVars } = useValidateCoupon();

  const handleTap = (code: string) => {
    validate(
      { code, cartTotalCoins },
      {
        onSuccess: res => {
          if (res.success && res.data) {
            onApply(res.data);
            onClose();
          } else {
            Alert.alert('Cannot Apply', res.message || 'This coupon cannot be applied to your cart.');
          }
        },
        onError: (err: any) => {
          Alert.alert('Cannot Apply', err?.message || 'This coupon cannot be applied to your cart.');
        },
      },
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable
        style={[styles.sheetBackdrop, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
        onPress={onClose}
      />

      {/* Sheet */}
      <View style={[styles.sheet, { backgroundColor: colors.card }]}>
        {/* Handle */}
        <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={styles.sheetHeader}>
          <View style={[styles.sheetIconWrap, { backgroundColor: withOpacity('#F59E0B', 0.12) }]}>
            <Icon name="Ticket" size={18} color="#F59E0B" />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <AppText variant="headline" weight="semiBold" style={{ color: colors.foreground }}>
              Available Offers
            </AppText>
            <AppText variant="caption1" style={{ color: colors.mutedForeground, marginTop: 1 }}>
              {coupons.length} coupon{coupons.length !== 1 ? 's' : ''} available
            </AppText>
          </View>
          <Pressable
            onPress={onClose}
            style={[styles.sheetCloseBtn, { backgroundColor: withOpacity(colors.foreground, 0.08) }]}
          >
            <Icon name="X" size={16} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={[styles.sheetDivider, { backgroundColor: colors.border }]} />

        {/* Coupon list */}
        {isLoading ? (
          <View style={styles.sheetLoading}>
            <ActivityIndicator size="small" color="#F59E0B" />
            <AppText variant="caption1" style={{ color: colors.mutedForeground, marginTop: 8 }}>
              Loading offers…
            </AppText>
          </View>
        ) : coupons.length === 0 ? (
          <View style={styles.sheetLoading}>
            <AppText variant="subhead" style={{ color: colors.mutedForeground }}>
              No offers available right now
            </AppText>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetList}
          >
            {coupons.map((coupon, i) => {
              const eligible   = isEligible(coupon, cartTotalCoins);
              const isApplied  = appliedCode === coupon.code;
              const isLoading  = isValidating && (validatingVars as any)?.code === coupon.code;
              const accentColor = isApplied ? '#10B981' : eligible ? '#F59E0B' : colors.mutedForeground;

              return (
                <Animated.View
                  key={coupon._id}
                  entering={FadeInDown.delay(i * 60).duration(300)}
                  style={[
                    styles.couponListItem,
                    {
                      backgroundColor: isApplied
                        ? withOpacity('#10B981', isDark ? 0.1 : 0.06)
                        : eligible
                        ? isDark ? withOpacity('#F59E0B', 0.07) : withOpacity('#F59E0B', 0.04)
                        : withOpacity(colors.foreground, 0.03),
                      borderColor: isApplied
                        ? withOpacity('#10B981', 0.35)
                        : eligible
                        ? withOpacity('#F59E0B', 0.3)
                        : withOpacity(colors.border, 0.5),
                      opacity: eligible ? 1 : 0.55,
                    },
                  ]}
                >
                  {/* Left dashed border accent */}
                  <View style={[styles.couponAccentBar, { backgroundColor: accentColor }]} />

                  <View style={styles.couponListBody}>
                    {/* Top row: code + badge */}
                    <View style={styles.couponListTop}>
                      <View style={[styles.couponCodeBadge, { backgroundColor: withOpacity(accentColor, 0.15) }]}>
                        <AppText variant="caption1" weight="bold" style={{ color: accentColor, letterSpacing: 1 }}>
                          {coupon.code}
                        </AppText>
                      </View>
                      {isApplied && (
                        <View style={[styles.appliedBadge, { backgroundColor: withOpacity('#10B981', 0.15) }]}>
                          <Icon name="CheckCircle2" size={11} color="#10B981" />
                          <AppText variant="caption2" weight="bold" style={{ color: '#10B981', marginLeft: 3 }}>
                            Applied
                          </AppText>
                        </View>
                      )}
                    </View>

                    {/* Discount headline */}
                    <AppText
                      variant="subhead"
                      weight="bold"
                      style={{ color: colors.foreground, marginTop: 6 }}
                    >
                      {formatDiscount(coupon)}
                    </AppText>

                    {/* Description */}
                    <AppText
                      variant="caption1"
                      style={{ color: colors.mutedForeground, marginTop: 3, lineHeight: 16 }}
                    >
                      {coupon.description}
                    </AppText>

                    {/* Min cart requirement */}
                    {coupon.minCartCoins > 0 && (
                      <View style={styles.couponMeta}>
                        <Icon
                          name={eligible ? 'CheckCircle2' : 'AlertCircle'}
                          size={11}
                          color={eligible ? '#10B981' : '#F59E0B'}
                        />
                        <AppText
                          variant="caption2"
                          style={{
                            color: eligible ? '#10B981' : '#F59E0B',
                            marginLeft: 4,
                          }}
                        >
                          {eligible
                            ? `Min. ${coupon.minCartCoins.toLocaleString()} coins ✓`
                            : `Min. ${coupon.minCartCoins.toLocaleString()} coins required`}
                        </AppText>
                      </View>
                    )}

                    {/* Expiry */}
                    {coupon.validUntil && (
                      <View style={styles.couponMeta}>
                        <Icon name="Clock" size={11} color={colors.mutedForeground} />
                        <AppText variant="caption2" style={{ color: colors.mutedForeground, marginLeft: 4 }}>
                          Expires {new Date(coupon.validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </AppText>
                      </View>
                    )}
                  </View>

                  {/* Apply / Applied button */}
                  <Pressable
                    onPress={() => eligible && !isApplied ? handleTap(coupon.code) : undefined}
                    disabled={!eligible || isApplied || isLoading}
                    style={[
                      styles.couponApplyPill,
                      {
                        backgroundColor: isApplied
                          ? withOpacity('#10B981', 0.15)
                          : eligible
                          ? '#F59E0B'
                          : withOpacity(colors.foreground, 0.08),
                      },
                    ]}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <AppText
                        variant="caption1"
                        weight="bold"
                        style={{
                          color: isApplied ? '#10B981' : eligible ? '#fff' : colors.mutedForeground,
                        }}
                      >
                        {isApplied ? 'Applied' : eligible ? 'Apply' : 'Ineligible'}
                      </AppText>
                    )}
                  </Pressable>
                </Animated.View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

// ─── CouponSection ────────────────────────────────────────────────────────────

interface CouponSectionProps {
  cartTotalCoins: number;
  appliedCoupon: ValidateCouponResult | null;
  onApply: (coupon: ValidateCouponResult) => void;
  onRemove: () => void;
  colors: any;
  isDark: boolean;
}

const CouponSection = ({
  cartTotalCoins,
  appliedCoupon,
  onApply,
  onRemove,
  colors,
  isDark,
}: CouponSectionProps) => {
  const [code, setCode]           = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const { mutate: validate, isPending } = useValidateCoupon();

  const handleApply = () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    Keyboard.dismiss();
    validate(
      { code: trimmed, cartTotalCoins },
      {
        onSuccess: res => {
          if (res.success && res.data) {
            onApply(res.data);
            setCode('');
          } else {
            Alert.alert('Invalid Coupon', res.message || 'This coupon code is not valid.');
          }
        },
        onError: (err: any) => {
          Alert.alert('Invalid Coupon', err?.message || 'This coupon code is not valid.');
        },
      },
    );
  };

  // ── Applied state ──────────────────────────────────────────────────────────
  if (appliedCoupon) {
    return (
      <>
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={[
            styles.couponApplied,
            { backgroundColor: withOpacity('#10B981', 0.08), borderColor: withOpacity('#10B981', 0.3) },
          ]}
        >
          <View style={[styles.couponAppliedIcon, { backgroundColor: withOpacity('#10B981', 0.15) }]}>
            <Icon name="BadgePercent" size={18} color="#10B981" />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={styles.couponAppliedRow}>
              <AppText variant="subhead" weight="bold" style={{ color: '#10B981' }}>
                {appliedCoupon.code}
              </AppText>
              <View style={[styles.savingPill, { backgroundColor: withOpacity('#10B981', 0.15) }]}>
                <AppText variant="caption2" weight="bold" style={{ color: '#10B981' }}>
                  -{appliedCoupon.discountCoins.toLocaleString()} coins
                </AppText>
              </View>
            </View>
            <AppText variant="caption1" style={{ color: colors.mutedForeground, marginTop: 2 }}>
              {appliedCoupon.description}
            </AppText>
          </View>
          <Pressable
            onPress={onRemove}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.couponRemoveBtn, { backgroundColor: withOpacity('#EF4444', 0.1) }]}
          >
            <Icon name="X" size={14} color="#EF4444" />
          </Pressable>
        </Animated.View>

        {/* View all offers link even when applied */}
        <Pressable onPress={() => setSheetOpen(true)} style={styles.viewOffersLink}>
          <Icon name="Ticket" size={12} color="#F59E0B" />
          <AppText variant="caption1" weight="semiBold" style={{ color: '#F59E0B', marginLeft: 4 }}>
            View all offers
          </AppText>
        </Pressable>

        <CouponListSheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          cartTotalCoins={cartTotalCoins}
          appliedCode={appliedCoupon.code}
          onApply={c => { onApply(c); }}
          colors={colors}
          isDark={isDark}
        />
      </>
    );
  }

  // ── Input state ────────────────────────────────────────────────────────────
  return (
    <>
      <View style={[styles.couponCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Header row */}
        <View style={styles.couponHeader}>
          <View style={[styles.couponIconWrap, { backgroundColor: withOpacity('#F59E0B', 0.12) }]}>
            <Icon name="Ticket" size={16} color="#F59E0B" />
          </View>
          <AppText variant="subhead" weight="semiBold" style={{ marginLeft: 10, flex: 1, color: colors.foreground }}>
            Apply Coupon
          </AppText>
          <Pressable onPress={() => setSheetOpen(true)} style={styles.viewOffersBtn}>
            <AppText variant="caption1" weight="semiBold" style={{ color: '#F59E0B' }}>
              View all
            </AppText>
            <Icon name="ChevronRight" size={13} color="#F59E0B" />
          </Pressable>
        </View>

        {/* Input row */}
        <View style={[styles.couponInputRow, { borderColor: colors.border, backgroundColor: colors.inputBackground ?? colors.secondary }]}>
          <TextInput
            value={code}
            onChangeText={t => setCode(t.toUpperCase())}
            placeholder="Enter coupon code"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleApply}
            style={[styles.couponTextInput, { color: colors.foreground }]}
          />
          <Pressable
            onPress={handleApply}
            disabled={isPending || !code.trim()}
            style={[
              styles.couponApplyBtn,
              { backgroundColor: code.trim() ? '#F59E0B' : withOpacity('#F59E0B', 0.3) },
            ]}
          >
            {isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <AppText variant="caption1" weight="bold" style={{ color: '#fff' }}>Apply</AppText>
            )}
          </Pressable>
        </View>
      </View>

      <CouponListSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        cartTotalCoins={cartTotalCoins}
        appliedCode={null}
        onApply={onApply}
        colors={colors}
        isDark={isDark}
      />
    </>
  );
};

// ─── CartScreen ───────────────────────────────────────────────────────────────

const CartScreen = () => {
  const { colors, radius, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const route = useRoute<CartRouteProp>();

  const { items, updateQuantity, removeFromCart, totalCoinPrice, clearCart } = useCart();
  const { mutate: buyWithCoinsAPI, isPending } = useBuyWithCoins();
  const { data: addressList = [] } = useAddresses();
  const coinsBalance = useGamificationStore(s => s.coinsBalance);
  const setCoinsBalance = useGamificationStore(s => s.setCoinsBalance);

  const [selectedAddress, setSelectedAddress] = useState<SavedAddress | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<ValidateCouponResult | null>(null);

  // ── Custom Alert Dialog state ────────────────────────────────────────────────
  const [alertConfig, setAlertConfig] = useState<Omit<AlertDialogProps, 'visible' | 'onClose'> | null>(null);
  const showAlert = useCallback((config: Omit<AlertDialogProps, 'visible' | 'onClose'>) => {
    setAlertConfig(config);
  }, []);
  const hideAlert = useCallback(() => setAlertConfig(null), []);

  // Auto-select default address when list loads
  useEffect(() => {
    if (addressList.length > 0 && !selectedAddress) {
      setSelectedAddress(addressList.find(a => a.isDefault) ?? addressList[0]);
    }
  }, [addressList]);

  useEffect(() => {
    const incoming = (route.params as any)?.selectedAddress as SavedAddress | undefined;
    if (incoming) setSelectedAddress(incoming);
  }, [route.params]);

  // Clear coupon if cart changes (items added/removed)
  const prevItemCount = useRef(items.length);
  useEffect(() => {
    if (items.length !== prevItemCount.current) {
      setAppliedCoupon(null);
      prevItemCount.current = items.length;
    }
  }, [items.length]);

  const totalItems     = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);
  const totalMRPCoins  = useMemo(() => items.reduce((s, i) => s + i.product.price * COIN_RATE * i.quantity, 0), [items]);
  const productSavings = Math.max(0, totalMRPCoins - totalCoinPrice);
  const couponDiscount = appliedCoupon?.discountCoins ?? 0;
  const finalTotal     = Math.max(0, totalCoinPrice - couponDiscount);
  const hasEnoughCoins = coinsBalance >= finalTotal;
  const coinShortfall  = Math.max(0, finalTotal - coinsBalance);

  const handleCheckout = () => {
    // Require email verification before purchase
    const user = useAuthStore.getState().user;
    if (!user?.emailVerified) {
      showAlert({
        variant: 'warning',
        title: 'Verification Required',
        message: 'Please verify your email before making a purchase.',
        actions: [
          { label: 'Cancel', onPress: hideAlert, variant: 'outline' },
          { label: 'Go to Profile', onPress: () => { hideAlert(); navigation.goBack(); }, variant: 'primary' },
        ],
      });
      return;
    }

    if (!selectedAddress) {
      showAlert({
        variant: 'warning',
        title: 'No Address',
        message: 'Add a delivery address first.',
        actions: [
          { label: 'Cancel', onPress: hideAlert, variant: 'outline' },
          { label: 'Add Address', onPress: () => { hideAlert(); navigation.navigate(ShopRoutes.ADDRESSES, { selectMode: true } as any); }, variant: 'primary' },
        ],
      });
      return;
    }
    if (!hasEnoughCoins) {
      showAlert({
        variant: 'error',
        title: 'Not Enough Coins',
        message: 'Earn more by completing your daily step goal!',
        details: [
          { emoji: '🪙', text: `Required: ${finalTotal.toLocaleString()} coins` },
          { emoji: '💰', text: `You have: ${coinsBalance.toLocaleString()} coins` },
          { emoji: '📉', text: `Short by: ${coinShortfall.toLocaleString()} coins` },
        ],
        actions: [
          { label: 'OK', onPress: hideAlert, variant: 'primary' },
        ],
      });
      return;
    }
    buyWithCoinsAPI(
      {
        items: items.map(i => ({ productId: i.product._id, quantity: i.quantity })),
        shippingAddress: {
          street: selectedAddress.street,
          city: selectedAddress.city,
          state: selectedAddress.state,
          zipCode: selectedAddress.zipCode,
          country: selectedAddress.country,
        },
        couponCode: appliedCoupon?.code,
      },
      {
        onSuccess: res => {
          if (res.success) {
            const remaining = res.data?.remainingCoins;
            if (remaining !== undefined) setCoinsBalance(remaining);
            clearCart();
            setAppliedCoupon(null);
            const orderId = res.data?.order?._id ? `#${res.data.order._id.slice(-6).toUpperCase()}` : '';
            const savedTotal = productSavings + couponDiscount;
            showAlert({
              variant: 'success',
              title: 'Order Placed!',
              message: `Order ${orderId} confirmed successfully.`,
              details: [
                { emoji: '💰', text: `Paid: ${finalTotal.toLocaleString()} coins` },
                ...(savedTotal > 0 ? [{ emoji: '🏷️', text: `Saved: ${savedTotal.toLocaleString()} coins` }] : []),
                { emoji: '🪙', text: `Remaining: ${(remaining ?? coinsBalance - finalTotal).toLocaleString()} coins` },
              ],
              actions: [
                { label: 'View Orders', onPress: () => { hideAlert(); navigation.navigate(ShopRoutes.ORDER_HISTORY); }, variant: 'outline' },
                { label: 'Continue', onPress: () => { hideAlert(); navigation.goBack(); }, variant: 'primary' },
              ],
            });
          } else {
            showAlert({
              variant: 'error',
              title: 'Checkout Failed',
              message: res.message || 'Something went wrong. Please try again.',
              actions: [
                { label: 'OK', onPress: hideAlert, variant: 'primary' },
              ],
            });
          }
        },
        onError: (err: any) => {
          showAlert({
            variant: 'error',
            title: 'Checkout Failed',
            message: err?.message || 'Payment failed. Please try again.',
            actions: [
              { label: 'OK', onPress: hideAlert, variant: 'primary' },
            ],
          });
        },
      },
    );
  };

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <>
        <Screen safeArea={false} header={<Header backLabel='' bordered showBack title='My Cart'/>}>

          <Animated.View entering={FadeInUp.duration(350)} style={styles.emptyWrap}>
            <View style={[styles.emptyIcon, { backgroundColor: withOpacity('#F5C518', 0.12) }]}>
              <Icon name="ShoppingCart" size={44} color="#B45309" />
            </View>
            <AppText variant="title3" weight="bold" style={{ marginTop: 20 }}>Your cart is empty</AppText>
            <AppText variant="body" secondary align="center" style={{ marginTop: 8, lineHeight: 22, paddingHorizontal: 32 }}>
              Add products and buy them with your earned fitness coins — no real money needed!
            </AppText>
            <Pressable
              onPress={() => navigation.goBack()}
              style={[styles.shopNowBtn, { backgroundColor: '#92400E', borderRadius: 16, marginTop: 28 }]}
            >
              <Icon name="Coins" size={18} color="#FEF3C7" />
              <AppText variant="body" weight="bold" color="#FEF3C7" style={{ marginLeft: 8 }}>Shop with Coins</AppText>
            </Pressable>
          </Animated.View>
      
        </Screen>

        {/* Alert dialog must render here too — after purchase clears cart, this branch renders */}
        <AlertDialog
          visible={alertConfig !== null}
          onClose={hideAlert}
          variant={alertConfig?.variant}
          title={alertConfig?.title ?? ''}
          message={alertConfig?.message}
          details={alertConfig?.details}
          actions={alertConfig?.actions}
          closeOnBackdrop={false}
        />
      </>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="ArrowLeft" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <AppText variant="headline" weight="semiBold">Your Cart</AppText>
          <AppText variant="caption2" secondary>{totalItems} item{totalItems > 1 ? 's' : ''}</AppText>
        </View>
        <Pressable
          onPress={clearCart}
          style={[styles.clearBtn, { backgroundColor: withOpacity(colors.destructive, 0.08), borderRadius: 8 }]}
        >
          <AppText variant="caption1" weight="semiBold" color={colors.destructive}>Clear</AppText>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={item => item.product._id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 260 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListHeaderComponent={
          <Animated.View entering={FadeInDown.duration(300)}>
            {/* Compact coin balance bar */}
            <View style={[styles.balanceBar, { backgroundColor: withOpacity('#F5C518', 0.08), borderColor: withOpacity('#F5C518', 0.25) }]}>
              <View style={[styles.balanceBarIcon, { backgroundColor: withOpacity('#F5C518', 0.18) }]}>
                <Icon name="Coins" size={14} color="#B45309" />
              </View>
              <AppText variant="caption1" weight="bold" color="#92400E" style={{ marginLeft: 8 }}>
                {coinsBalance.toFixed(2)}
              </AppText>
              <AppText variant="caption2" color="#B45309" style={{ marginLeft: 3 }}>coins</AppText>
              <View style={{ flex: 1 }} />
              {(productSavings > 0 || couponDiscount > 0) && (
                <View style={[styles.balanceBarSavings, { backgroundColor: withOpacity('#10B981', 0.1) }]}>
                  <Icon name="TrendingDown" size={11} color="#10B981" />
                  <AppText variant="caption2" weight="bold" color="#10B981" style={{ marginLeft: 3 }}>
                    -{(productSavings + couponDiscount).toLocaleString()}
                  </AppText>
                </View>
              )}
            </View>
          </Animated.View>
        }
        renderItem={({ item, index }) => {
          const activePrice = item.product.discountedPrice ?? item.product.price;
          const hasDiscount = item.product.discountedPrice != null && item.product.discountedPrice < item.product.price;
          const coinPPU = Math.round(activePrice * COIN_RATE);
          const origCoinPPU = Math.round(item.product.price * COIN_RATE);
          const lineCoins = coinPPU * item.quantity;

          return (
            <Animated.View
              layout={LinearTransition.springify()}
              style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16 }]}
            >
              <Animated.View
                entering={FadeInDown.delay(index * 50).duration(350)}
                style={{ flex: 1, flexDirection: 'row' }}
              >
              <Image
                source={{ uri: item.product.images?.[0] }}
                style={[styles.itemImg, { borderRadius: 12, backgroundColor: withOpacity(item.product.category.color, 0.07) }]}
              />
              <View style={styles.itemBody}>
                <View style={styles.itemTopRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <AppText variant="subhead" weight="semiBold" numberOfLines={2}>{item.product.name}</AppText>
                    <View style={[styles.catTag, { backgroundColor: withOpacity(item.product.category.color, 0.1), marginTop: 4 }]}>
                      <AppText variant="caption2" weight="semiBold" color={item.product.category.color}>{item.product.category.name}</AppText>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => removeFromCart(item.product._id)}
                    style={[styles.deleteBtn, { backgroundColor: withOpacity(colors.destructive, 0.08) }]}
                  >
                    <Icon name="Trash2" size={15} color={colors.destructive} />
                  </Pressable>
                </View>

                <View style={[styles.coinRow, { marginTop: 10 }]}>
                  <Icon name="Coins" size={14} color="#B45309" />
                  <AppText variant="body" weight="bold" color="#92400E" style={{ marginLeft: 4 }}>{coinPPU.toLocaleString()}</AppText>
                  <AppText variant="caption2" color="#B45309" style={{ marginLeft: 2 }}>coins</AppText>
                  {hasDiscount && (
                    <AppText variant="caption2" secondary style={{ marginLeft: 8, textDecorationLine: 'line-through' }}>{origCoinPPU.toLocaleString()}</AppText>
                  )}
                </View>

                <View style={[styles.itemBottomRow, { marginTop: 10 }]}>
                  <View style={[styles.qtyControl, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Pressable onPress={() => updateQuantity(item.product._id, item.quantity - 1)} style={styles.qtyBtn}>
                      <Icon name="Minus" size={14} color={colors.foreground} />
                    </Pressable>
                    <AppText variant="subhead" weight="bold" style={{ minWidth: 28, textAlign: 'center' }}>{item.quantity}</AppText>
                    <Pressable onPress={() => updateQuantity(item.product._id, item.quantity + 1)} style={styles.qtyBtn}>
                      <Icon name="Plus" size={14} color={colors.foreground} />
                    </Pressable>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <AppText variant="caption2" secondary>Total</AppText>
                    <View style={styles.coinRow}>
                      <Icon name="Coins" size={13} color="#B45309" />
                      <AppText variant="subhead" weight="bold" color="#92400E" style={{ marginLeft: 3 }}>{lineCoins.toLocaleString()}</AppText>
                    </View>
                  </View>
                </View>
              </View>
              </Animated.View>
            </Animated.View>
          );
        }}
        ListFooterComponent={
          <Fragment>
            {/* Delivery address */}
            <Pressable
              onPress={() => navigation.navigate(ShopRoutes.ADDRESSES, { selectMode: true } as any)}
              style={[styles.addrCard, { backgroundColor: colors.card, borderColor: selectedAddress ? withOpacity(colors.primary, 0.4) : withOpacity('#EF4444', 0.4), marginTop: 12 }]}
            >
              <View style={styles.addrTop}>
                <View style={[styles.addrIconWrap, { backgroundColor: withOpacity(selectedAddress ? colors.primary : '#EF4444', 0.1) }]}>
                  <Icon name="MapPin" size={16} color={selectedAddress ? colors.primary : '#EF4444'} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <AppText variant="subhead" weight="semiBold">Deliver to</AppText>
                  {selectedAddress ? (
                    <AppText variant="caption1" secondary numberOfLines={1} style={{ marginTop: 2 }}>
                      {[selectedAddress.street, selectedAddress.city, selectedAddress.state].filter(Boolean).join(', ')}
                    </AppText>
                  ) : (
                    <AppText variant="caption1" color="#EF4444" style={{ marginTop: 2 }}>Tap to add address</AppText>
                  )}
                </View>
                <View style={styles.changeRow}>
                  <AppText variant="caption1" weight="semiBold" color={colors.primary}>{selectedAddress ? 'Change' : 'Add'}</AppText>
                  <Icon name="ChevronRight" size={13} color={colors.primary} />
                </View>
              </View>
            </Pressable>

            {/* ── Coupon section ── */}
            <View style={{ marginTop: 12 }}>
              <CouponSection
                cartTotalCoins={totalCoinPrice}
                appliedCoupon={appliedCoupon}
                onApply={setAppliedCoupon}
                onRemove={() => setAppliedCoupon(null)}
                colors={colors}
                isDark={isDark}
              />
            </View>

            {/* Bill summary */}
            <View style={[styles.billCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
              <AppText variant="headline" weight="semiBold" style={{ marginBottom: 14 }}>Order Summary</AppText>

              {/* MRP row */}
              <View style={styles.billRow}>
                <AppText variant="body" secondary>Subtotal (MRP)</AppText>
                <View style={styles.coinRow}>
                  <Icon name="Coins" size={13} color="#B45309" />
                  <AppText variant="body" weight="semiBold" style={{ marginLeft: 4 }}>{totalMRPCoins.toLocaleString()}</AppText>
                </View>
              </View>

              {/* Product discount row */}
              {productSavings > 0 && (
                <View style={[styles.billRow, { marginTop: 10 }]}>
                  <AppText variant="body" secondary>Product Discount</AppText>
                  <View style={styles.coinRow}>
                    <Icon name="Coins" size={13} color="#10B981" />
                    <AppText variant="body" weight="semiBold" color="#10B981" style={{ marginLeft: 4 }}>-{productSavings.toLocaleString()}</AppText>
                  </View>
                </View>
              )}

              {/* Coupon discount row */}
              {couponDiscount > 0 && (
                <Animated.View entering={FadeInDown.duration(250)} style={[styles.billRow, { marginTop: 10 }]}>
                  <View style={styles.couponBillLabel}>
                    <Icon name="Ticket" size={13} color="#F59E0B" />
                    <AppText variant="body" secondary style={{ marginLeft: 5 }}>
                      Coupon ({appliedCoupon?.code})
                    </AppText>
                  </View>
                  <View style={styles.coinRow}>
                    <Icon name="Coins" size={13} color="#F59E0B" />
                    <AppText variant="body" weight="semiBold" color="#F59E0B" style={{ marginLeft: 4 }}>-{couponDiscount.toLocaleString()}</AppText>
                  </View>
                </Animated.View>
              )}

              <View style={[styles.billDivider, { backgroundColor: colors.border, marginVertical: 14 }]} />

              {/* Total */}
              <View style={styles.billRow}>
                <AppText variant="title3" weight="bold">Total</AppText>
                <View style={styles.coinRow}>
                  <Icon name="Coins" size={20} color="#B45309" />
                  <AppText variant="title2" weight="bold" color="#92400E" style={{ marginLeft: 6 }}>{finalTotal.toLocaleString()}</AppText>
                  {couponDiscount > 0 && (
                    <AppText variant="caption2" secondary style={{ marginLeft: 6, textDecorationLine: 'line-through' }}>
                      {totalCoinPrice.toLocaleString()}
                    </AppText>
                  )}
                </View>
              </View>

              {/* Balance check */}
              <View style={[styles.balanceCheck, { backgroundColor: hasEnoughCoins ? withOpacity('#10B981', 0.07) : withOpacity('#EF4444', 0.07), borderColor: hasEnoughCoins ? withOpacity('#10B981', 0.25) : withOpacity('#EF4444', 0.25), marginTop: 14 }]}>
                <Icon name={hasEnoughCoins ? 'CheckCircle2' : 'AlertCircle'} size={15} color={hasEnoughCoins ? '#10B981' : '#EF4444'} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <AppText variant="caption1" weight="semiBold" color={hasEnoughCoins ? '#10B981' : '#EF4444'}>
                    {hasEnoughCoins ? `Balance: ${coinsBalance.toFixed(2)} coins ✓` : `Need ${coinShortfall.toFixed(2)} more coins`}
                  </AppText>
                  {!hasEnoughCoins && (
                    <AppText variant="caption2" secondary style={{ marginTop: 2 }}>Complete your daily step goal to earn coins!</AppText>
                  )}
                </View>
              </View>
            </View>
          </Fragment>
        }
      />

      {/* Sticky footer */}
      <Animated.View
        entering={FadeInUp.delay(100).duration(350)}
        style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}
      >
        <View style={[styles.footerBalance, { backgroundColor: withOpacity('#F5C518', 0.1), borderColor: withOpacity('#F5C518', 0.3) }]}>
          <Icon name="Coins" size={14} color="#B45309" />
          <AppText variant="caption1" weight="semiBold" color="#92400E" style={{ marginLeft: 6 }}>Balance: {coinsBalance.toFixed(2)}</AppText>
          <View style={{ flex: 1 }} />
          {couponDiscount > 0 ? (
            <View style={styles.coinRow}>
              <AppText variant="caption2" secondary style={{ textDecorationLine: 'line-through', marginRight: 4 }}>
                {totalCoinPrice.toLocaleString()}
              </AppText>
              <AppText variant="caption2" weight="bold" color="#F59E0B">{finalTotal.toLocaleString()}</AppText>
            </View>
          ) : (
            <AppText variant="caption2" color="#B45309">Need: {finalTotal.toLocaleString()}</AppText>
          )}
        </View>

        <Pressable
          onPress={handleCheckout}
          disabled={isPending || !hasEnoughCoins}
          style={[styles.checkoutBtn, { backgroundColor: isPending || !hasEnoughCoins ? colors.mutedForeground : '#92400E' }]}
        >
          {isPending ? (
            <ActivityIndicator color="#FEF3C7" />
          ) : (
            <>
              <Icon name="Coins" size={20} color="#FEF3C7" />
              <AppText variant="body" weight="bold" color="#FEF3C7" style={{ marginLeft: 8 }}>
                {hasEnoughCoins ? `Pay ${finalTotal.toLocaleString()} Coins` : 'Not Enough Coins'}
              </AppText>
            </>
          )}
        </Pressable>
      </Animated.View>

      {/* Custom Alert Dialog */}
      <AlertDialog
        visible={alertConfig !== null}
        onClose={hideAlert}
        variant={alertConfig?.variant}
        title={alertConfig?.title ?? ''}
        message={alertConfig?.message}
        details={alertConfig?.details}
        actions={alertConfig?.actions}
        closeOnBackdrop={false}
      />
    </View>
  );
};

export default CartScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 6 },

  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center' },
  shopNowBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 15 },

  balanceBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  balanceBarIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  balanceBarSavings: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },

  itemCard: { borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  itemImg: { width: 90, height: 90 },
  itemBody: { flex: 1, marginLeft: 12 },
  itemTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  catTag: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  deleteBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  coinRow: { flexDirection: 'row', alignItems: 'center' },
  itemBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qtyControl: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, padding: 3 },
  qtyBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

  addrCard: { borderRadius: 16, borderWidth: 1.5, padding: 14 },
  addrTop: { flexDirection: 'row', alignItems: 'center' },
  addrIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  changeRow: { flexDirection: 'row', alignItems: 'center' },

  billCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billDivider: { height: 1 },
  balanceCheck: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 12, borderWidth: 1, padding: 12 },

  footer: { position: 'absolute', bottom: 0, width: '100%', borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12 },
  footerBalance: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  checkoutBtn: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 16 },

  // ── Coupon ──
  couponCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  couponHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  couponIconWrap: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  couponInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  couponTextInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
  couponApplyBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
  couponApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  couponAppliedIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  couponAppliedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  savingPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  couponRemoveBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  couponBillLabel: { flexDirection: 'row', alignItems: 'center' },
  viewOffersBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewOffersLink: { flexDirection: 'row', alignItems: 'center', marginTop: 8, alignSelf: 'flex-start' },

  // ── Coupon list sheet ──
  sheetBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 32,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sheetIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sheetCloseBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sheetDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  sheetLoading: { alignItems: 'center', paddingVertical: 40 },
  sheetList: { padding: 16, gap: 12 },

  // ── Coupon list item ──
  couponListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 12,
    gap: 10,
  },
  couponAccentBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  couponListBody: { flex: 1 },
  couponListTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  couponCodeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  appliedBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  couponMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  couponApplyPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
});
