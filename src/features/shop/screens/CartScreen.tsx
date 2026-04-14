// src/features/shop/screens/CartScreen.tsx — Advanced Redesign
import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import Animated, { FadeInDown, FadeInUp, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../hooks/useTheme';
import AppText from '../../../components/AppText';
import { Icon } from '../../../components/Icon';
import { withOpacity } from '../../../utils/withOpacity';
import { useCart } from '../context/CartContext';
import { useBuyWithCoins, useAddresses } from '../hooks/useShop';
import { ShopRoutes } from '../../../navigation/routes';
import type { ShopStackParamList } from '../../../types/navigation.types';
import { useGamificationStore } from '../../health/store/gamificationStore';
import type { SavedAddress } from '../types/shop.types';

type CartRouteProp = RouteProp<ShopStackParamList, typeof ShopRoutes.CART>;
const COIN_RATE = 10;

const CartScreen = () => {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const route = useRoute<CartRouteProp>();

  const { items, updateQuantity, removeFromCart, totalCoinPrice, clearCart } = useCart();
  const { mutate: buyWithCoinsAPI, isPending } = useBuyWithCoins();
  const { mutate: fetchAddresses, data: addrData } = useAddresses();
  const coinsBalance = useGamificationStore(s => s.coinsBalance);
  const setCoinsBalance = useGamificationStore(s => s.setCoinsBalance);

  useEffect(() => { fetchAddresses(); }, []);

  const addressList = useMemo<SavedAddress[]>(() => addrData?.data ?? [], [addrData]);
  const [selectedAddress, setSelectedAddress] = useState<SavedAddress | null>(null);

  useEffect(() => {
    if (addressList.length > 0 && !selectedAddress) {
      setSelectedAddress(addressList.find(a => a.isDefault) ?? addressList[0]);
    }
  }, [addressList]);

  useEffect(() => {
    const incoming = (route.params as any)?.selectedAddress as SavedAddress | undefined;
    if (incoming) setSelectedAddress(incoming);
  }, [route.params]);

  const totalItems = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);
  const totalMRPCoins = useMemo(() => items.reduce((s, i) => s + i.product.price * COIN_RATE * i.quantity, 0), [items]);
  const savedCoins = Math.max(0, totalMRPCoins - totalCoinPrice);
  const hasEnoughCoins = coinsBalance >= totalCoinPrice;
  const coinShortfall = Math.max(0, totalCoinPrice - coinsBalance);

  const handleCheckout = () => {
    if (!selectedAddress) {
      Alert.alert('No Address', 'Add a delivery address first.', [
        { text: 'Add Address', onPress: () => navigation.navigate(ShopRoutes.ADDRESSES, { selectMode: true } as any) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    if (!hasEnoughCoins) {
      Alert.alert('Not Enough Coins', `You need ${totalCoinPrice.toLocaleString()} coins but have ${coinsBalance.toLocaleString()}.\n\nEarn more by completing your daily step goal!`);
      return;
    }
    buyWithCoinsAPI(
      {
        items: items.map(i => ({ productId: i.product._id, quantity: i.quantity })),
        shippingAddress: { street: selectedAddress.street, city: selectedAddress.city, state: selectedAddress.state, zipCode: selectedAddress.zipCode, country: selectedAddress.country },
      },
      {
        onSuccess: res => {
          if (res.success) {
            const remaining = res.data?.remainingCoins;
            if (remaining !== undefined) setCoinsBalance(remaining);
            clearCart();
            const orderId = res.data?.order?._id ? `#${res.data.order._id.slice(-6).toUpperCase()}` : '';
            Alert.alert('🎉 Order Placed!', `Order ${orderId} placed!\n\n💰 Used: ${totalCoinPrice.toLocaleString()} coins\n💰 Remaining: ${(remaining ?? coinsBalance - totalCoinPrice).toLocaleString()} coins`, [
              { text: 'View Orders', onPress: () => navigation.navigate(ShopRoutes.ORDER_HISTORY) },
              { text: 'Continue', onPress: () => navigation.goBack() },
            ]);
          } else Alert.alert('Checkout Failed', res.message);
        },
        onError: (err: any) => Alert.alert('Checkout Failed', err?.message || 'Payment failed'),
      },
    );
  };

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="ArrowLeft" size={22} color={colors.foreground} />
          </Pressable>
          <AppText variant="headline" weight="semiBold">Cart</AppText>
          <View style={{ width: 40 }} />
        </View>

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
      </View>
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
            {/* Coin balance banner */}
            <View style={[styles.balanceBanner, { backgroundColor: withOpacity('#F5C518', 0.1), borderColor: withOpacity('#F5C518', 0.3), marginBottom: 16 }]}>
              <View style={[styles.balanceIconWrap, { backgroundColor: withOpacity('#F5C518', 0.2) }]}>
                <Icon name="Coins" size={20} color="#B45309" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <AppText variant="caption1" secondary>Your Coin Balance</AppText>
                <AppText variant="title3" weight="bold" color="#92400E">{coinsBalance.toLocaleString()} coins</AppText>
              </View>
              {savedCoins > 0 && (
                <View style={[styles.savingsBadge, { backgroundColor: withOpacity('#10B981', 0.12) }]}>
                  <Icon name="BadgePercent" size={13} color="#10B981" />
                  <AppText variant="caption2" weight="bold" color="#10B981" style={{ marginLeft: 4 }}>
                    Saved {savedCoins.toLocaleString()}
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
              entering={FadeInDown.delay(index * 50).duration(350)}
              layout={Layout.springify()}
              style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16 }]}
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

            {/* Bill summary */}
            <View style={[styles.billCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
              <AppText variant="headline" weight="semiBold" style={{ marginBottom: 14 }}>Order Summary</AppText>

              <View style={styles.billRow}>
                <AppText variant="body" secondary>Subtotal (MRP)</AppText>
                <View style={styles.coinRow}>
                  <Icon name="Coins" size={13} color="#B45309" />
                  <AppText variant="body" weight="semiBold" style={{ marginLeft: 4 }}>{totalMRPCoins.toLocaleString()}</AppText>
                </View>
              </View>

              {savedCoins > 0 && (
                <View style={[styles.billRow, { marginTop: 10 }]}>
                  <AppText variant="body" secondary>Discount</AppText>
                  <View style={styles.coinRow}>
                    <Icon name="Coins" size={13} color="#10B981" />
                    <AppText variant="body" weight="semiBold" color="#10B981" style={{ marginLeft: 4 }}>-{savedCoins.toLocaleString()}</AppText>
                  </View>
                </View>
              )}

              <View style={[styles.billDivider, { backgroundColor: colors.border, marginVertical: 14 }]} />

              <View style={styles.billRow}>
                <AppText variant="title3" weight="bold">Total</AppText>
                <View style={styles.coinRow}>
                  <Icon name="Coins" size={20} color="#B45309" />
                  <AppText variant="title2" weight="bold" color="#92400E" style={{ marginLeft: 6 }}>{totalCoinPrice.toLocaleString()}</AppText>
                </View>
              </View>

              {/* Balance check */}
              <View style={[styles.balanceCheck, { backgroundColor: hasEnoughCoins ? withOpacity('#10B981', 0.07) : withOpacity('#EF4444', 0.07), borderColor: hasEnoughCoins ? withOpacity('#10B981', 0.25) : withOpacity('#EF4444', 0.25), marginTop: 14 }]}>
                <Icon name={hasEnoughCoins ? 'CheckCircle2' : 'AlertCircle'} size={15} color={hasEnoughCoins ? '#10B981' : '#EF4444'} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <AppText variant="caption1" weight="semiBold" color={hasEnoughCoins ? '#10B981' : '#EF4444'}>
                    {hasEnoughCoins ? `Balance: ${coinsBalance.toLocaleString()} coins ✓` : `Need ${coinShortfall.toLocaleString()} more coins`}
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
          <AppText variant="caption1" weight="semiBold" color="#92400E" style={{ marginLeft: 6 }}>Balance: {coinsBalance.toLocaleString()}</AppText>
          <View style={{ flex: 1 }} />
          <AppText variant="caption2" color="#B45309">Need: {totalCoinPrice.toLocaleString()}</AppText>
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
                {hasEnoughCoins ? `Pay ${totalCoinPrice.toLocaleString()} Coins` : 'Not Enough Coins'}
              </AppText>
            </>
          )}
        </Pressable>
      </Animated.View>
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

  balanceBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 14 },
  balanceIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  savingsBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },

  itemCard: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, padding: 12 },
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
});
