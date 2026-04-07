// src/features/shop/screens/CartScreen.tsx
import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import Animated, {
  FadeInDown,
  FadeInUp,
  Layout,
} from 'react-native-reanimated';

import { useTheme } from '../../../hooks/useTheme';
import { AppView, AppText, Screen, Header, Icon } from '../../../components';
import { useCart } from '../context/CartContext';
import { useBuyWithCoins, useAddresses } from '../hooks/useShop';
import { ShopRoutes } from '../../../navigation/routes';
import type { ShopStackParamList } from '../../../types/navigation.types';
import { withOpacity } from '../../../utils/withOpacity';
import { useGamificationStore } from '../../health/store/gamificationStore';
import type { SavedAddress } from '../types/shop.types';

type CartRouteProp = RouteProp<ShopStackParamList, typeof ShopRoutes.CART>;

const COIN_RATE = 10; // 10 coins per ₹1

// ─── Label icon map ───────────────────────────────────────────────────────────
const LABEL_ICON: Record<string, string> = {
  Home: 'Home', Work: 'Briefcase', Office: 'Building2', Other: 'MapPin',
};

const CartScreen = () => {
  const { colors, spacing, radius } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const route = useRoute<CartRouteProp>();

  const { items, updateQuantity, removeFromCart, totalCoinPrice, clearCart } =
    useCart();

  const { mutate: buyWithCoinsAPI, isPending } = useBuyWithCoins();
  const { mutate: fetchAddresses, data: addrData } = useAddresses();

  // Live coin balance from Zustand store
  const coinsBalance = useGamificationStore(s => s.coinsBalance);
  const setCoinsBalance = useGamificationStore(s => s.setCoinsBalance);

  // Load saved addresses on mount
  useEffect(() => { fetchAddresses(); }, [fetchAddresses]);

  // Address list from API
  const addressList = useMemo<SavedAddress[]>(
    () => addrData?.data ?? [],
    [addrData],
  );

  // Selected address — persists any selection coming back from AddressesScreen
  const [selectedAddress, setSelectedAddress] = useState<SavedAddress | null>(null);

  // When address list loads, default to first default or first
  useEffect(() => {
    if (addressList.length > 0 && !selectedAddress) {
      setSelectedAddress(addressList.find(a => a.isDefault) ?? addressList[0]);
    }
  }, [addressList, selectedAddress]);

  // Accept address passed back from AddressesScreen via route params
  useEffect(() => {
    const incomingAddr = (route.params as any)?.selectedAddress as SavedAddress | undefined;
    if (incomingAddr) setSelectedAddress(incomingAddr);
  }, [route.params]);

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const totalMRPCoins = useMemo(
    () =>
      items.reduce((sum, item) => sum + item.product.price * COIN_RATE * item.quantity, 0),
    [items],
  );

  const savedCoins = Math.max(0, totalMRPCoins - totalCoinPrice);
  const hasEnoughCoins = coinsBalance >= totalCoinPrice;
  const coinShortfall = Math.max(0, totalCoinPrice - coinsBalance);

  const handleCheckout = () => {
    if (items.length === 0) return;

    if (!selectedAddress) {
      Alert.alert(
        '📍 No Address',
        'Please add a delivery address before placing your order.',
        [
          { text: 'Add Address', onPress: () => navigation.navigate(ShopRoutes.ADDRESSES, { selectMode: true } as any) },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }

    if (!hasEnoughCoins) {
      Alert.alert(
        '😅 Not Enough Coins',
        `You need ${totalCoinPrice.toLocaleString()} coins but only have ${coinsBalance.toLocaleString()}.\n\nEarn more coins by completing your daily step goal!`,
      );
      return;
    }

    const orderItems = items.map(i => ({
      productId: i.product._id,
      quantity: i.quantity,
    }));

    buyWithCoinsAPI(
      {
        items: orderItems,
        shippingAddress: {
          street:  selectedAddress.street,
          city:    selectedAddress.city,
          state:   selectedAddress.state,
          zipCode: selectedAddress.zipCode,
          country: selectedAddress.country,
        },
      },
      {
        onSuccess: res => {
          if (res.success) {
            // Update local coin balance immediately
            const remaining = res.data?.remainingCoins;
            if (remaining !== undefined) {
              setCoinsBalance(remaining);
            }
            clearCart();
            const orderId = res.data?.order?._id
              ? `#${res.data.order._id.slice(-6).toUpperCase()}`
              : '';
            Alert.alert(
              '🎉 Order Placed!',
              `Order ${orderId} was placed successfully!\n\n💰 Used: ${totalCoinPrice.toLocaleString()} coins\n💰 Remaining: ${(remaining ?? coinsBalance - totalCoinPrice).toLocaleString()} coins`,
              [{ text: 'View Orders', onPress: () => navigation.navigate(ShopRoutes.ORDER_HISTORY) },
               { text: 'Continue', onPress: () => navigation.goBack() }],
            );
          } else {
            Alert.alert('Checkout Failed', res.message);
          }
        },
        onError: (err: any) => {
          const msg =
            err?.response?.data?.message || err.message || 'Payment failed';
          Alert.alert('Checkout Failed', msg);
        },
      },
    );
  };

  const renderCartItem = ({ item, index }: { item: any; index: number }) => {
    const activePrice =
      item.product.discountedPrice ?? item.product.price;
    const originalPrice = item.product.price;
    const hasDiscount =
      item.product.discountedPrice != null &&
      item.product.discountedPrice < item.product.price;

    const coinPricePerUnit = Math.round(activePrice * COIN_RATE);
    const originalCoinPrice = Math.round(originalPrice * COIN_RATE);
    const lineCoins = coinPricePerUnit * item.quantity;

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 50).duration(350)}
        layout={Layout.springify()}
        style={[
          styles.itemCard,
          {
            backgroundColor: colors.card,
            borderRadius: radius.xl,
            borderColor: withOpacity(colors.border, 0.8),
            padding: spacing[3],
          },
        ]}
      >
        <Image
          source={{ uri: item.product.images?.[0] }}
          style={[
            styles.itemImage,
            {
              borderRadius: radius.lg,
              backgroundColor: withOpacity('#F5C518', 0.08),
            },
          ]}
        />

        <View style={styles.itemContent}>
          {/* Top row */}
          <View style={styles.topRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <AppText variant="subhead" weight="semiBold" numberOfLines={2}>
                {item.product.name}
              </AppText>
              <View
                style={[
                  styles.categoryChip,
                  {
                    marginTop: spacing[1],
                    backgroundColor: withOpacity(
                      item.product.category.color,
                      0.1,
                    ),
                    borderRadius: radius.full ?? 999,
                  },
                ]}
              >
                <AppText
                  variant="caption2"
                  color={item.product.category.color}
                  weight="semiBold"
                >
                  {item.product.category.name}
                </AppText>
              </View>
            </View>

            <Pressable
              onPress={() => removeFromCart(item.product._id)}
              style={[
                styles.deleteBtn,
                {
                  backgroundColor: withOpacity(colors.destructive, 0.08),
                  borderRadius: radius.full ?? 999,
                },
              ]}
            >
              <Icon name="Trash2" size={16} color={colors.destructive} />
            </Pressable>
          </View>

          {/* Coin price */}
          <View style={[styles.coinPriceRow, { marginTop: spacing[2] }]}>
            <Icon name="Coins" size={14} color="#B45309" />
            <AppText
              variant="body"
              weight="bold"
              color="#92400E"
              style={{ marginLeft: 5 }}
            >
              {coinPricePerUnit.toLocaleString()}
            </AppText>
            <AppText variant="caption1" color="#B45309" style={{ marginLeft: 2 }}>
              coins
            </AppText>
            {hasDiscount && (
              <AppText
                variant="caption2"
                secondary
                style={{ marginLeft: 8, textDecorationLine: 'line-through' }}
              >
                {originalCoinPrice.toLocaleString()}
              </AppText>
            )}
          </View>

          {/* Qty + Line total */}
          <View style={[styles.bottomRow, { marginTop: spacing[3] }]}>
            <View
              style={[
                styles.qtyWrap,
                {
                  backgroundColor: colors.background,
                  borderRadius: radius.lg,
                  borderColor: withOpacity(colors.border, 0.8),
                },
              ]}
            >
              <Pressable
                onPress={() =>
                  updateQuantity(item.product._id, item.quantity - 1)
                }
                style={styles.qtyBtn}
              >
                <Icon name="Minus" size={15} color={colors.foreground} />
              </Pressable>

              <View style={styles.qtyCenter}>
                <AppText variant="subhead" weight="semiBold">
                  {item.quantity}
                </AppText>
              </View>

              <Pressable
                onPress={() =>
                  updateQuantity(item.product._id, item.quantity + 1)
                }
                style={styles.qtyBtn}
              >
                <Icon name="Plus" size={15} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <AppText variant="caption1" secondary>
                Total
              </AppText>
              <View style={[styles.coinPriceRow, { marginTop: 2 }]}>
                <Icon name="Coins" size={13} color="#B45309" />
                <AppText
                  variant="subhead"
                  weight="bold"
                  color="#92400E"
                  style={{ marginLeft: 4 }}
                >
                  {lineCoins.toLocaleString()}
                </AppText>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  };

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <Screen padded={false} safeArea={false}>
        <AppView
          style={[styles.container, { backgroundColor: colors.background }]}
        >
          <Header showBack title="Cart" bordered backLabel="" />

          <View style={[styles.emptyWrap, { paddingHorizontal: spacing[6] }]}>
            <Animated.View
              entering={FadeInUp.duration(350)}
              style={[
                styles.emptyIconWrap,
                {
                  backgroundColor: withOpacity('#F5C518', 0.12),
                  borderRadius: 999,
                },
              ]}
            >
              <Icon name="ShoppingCart" size={42} color="#B45309" />
            </Animated.View>

            <AppText
              variant="title3"
              weight="bold"
              style={{ marginTop: spacing[4] }}
            >
              Your cart is empty
            </AppText>

            <AppText
              variant="body"
              secondary
              align="center"
              style={{ marginTop: spacing[2], lineHeight: 22 }}
            >
              Add products and buy them with your earned fitness coins — no
              real money needed!
            </AppText>

            <Pressable
              onPress={() => navigation.goBack()}
              style={[
                styles.shopNowBtn,
                {
                  backgroundColor: '#92400E',
                  borderRadius: radius.xl,
                  marginTop: spacing[6],
                },
              ]}
            >
              <Icon name="Coins" size={18} color="#FEF3C7" />
              <AppText
                variant="body"
                weight="semiBold"
                color="#FEF3C7"
                style={{ marginLeft: 8 }}
              >
                Shop with Coins
              </AppText>
            </Pressable>
          </View>
        </AppView>
      </Screen>
    );
  }

  // ── Filled cart ──────────────────────────────────────────────────────────────
  return (
    <Screen padded={false} safeArea={false}>
      <AppView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <Header
          bordered
          showBack
          title="Your Cart"
          backLabel=""
          rightAction={
            <Pressable
              onPress={clearCart}
              style={[
                styles.clearBtn,
                {
                  backgroundColor: withOpacity(colors.destructive, 0.08),
                  borderRadius: radius.full ?? 999,
                },
              ]}
            >
              <AppText
                variant="caption1"
                weight="semiBold"
                color={colors.destructive}
              >
                Clear
              </AppText>
            </Pressable>
          }
        />

        <FlatList
          data={items}
          keyExtractor={item => item.product._id}
          renderItem={({ item, index }) => renderCartItem({ item, index })}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            padding: spacing[4],
            paddingBottom: 300,
          }}
          ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
          ListHeaderComponent={
            <Animated.View entering={FadeInUp.duration(350)}>
              {/* Cart summary bar */}
              <View
                style={[
                  styles.summaryBar,
                  {
                    marginBottom: spacing[4],
                    backgroundColor: colors.card,
                    borderRadius: radius.xl,
                    borderColor: withOpacity(colors.border, 0.8),
                    padding: spacing[4],
                  },
                ]}
              >
                <View style={styles.summaryRow}>
                  <View>
                    <AppText variant="caption1" secondary>
                      Cart Summary
                    </AppText>
                    <AppText
                      variant="title3"
                      weight="bold"
                      style={{ marginTop: 4 }}
                    >
                      {totalItems} item{totalItems > 1 ? 's' : ''}
                    </AppText>
                  </View>

                  {savedCoins > 0 && (
                    <View
                      style={[
                        styles.savingsBadge,
                        {
                          backgroundColor: withOpacity(colors.success, 0.1),
                          borderRadius: radius.full ?? 999,
                        },
                      ]}
                    >
                      <Icon name="BadgePercent" size={14} color={colors.success} />
                      <AppText
                        variant="caption1"
                        weight="semiBold"
                        color={colors.success}
                        style={{ marginLeft: 6 }}
                      >
                        Saved {savedCoins.toLocaleString()} coins
                      </AppText>
                    </View>
                  )}
                </View>
              </View>
            </Animated.View>
          }
          ListFooterComponent={
            <Fragment>
              {/* ── Delivery Address Panel ── */}
              <Pressable
                onPress={() =>
                  navigation.navigate(ShopRoutes.ADDRESSES, { selectMode: true } as any)
                }
                style={[
                  styles.addrPanel,
                  {
                    marginTop: spacing[2],
                    backgroundColor: colors.card,
                    borderRadius: radius.xl,
                    borderColor: selectedAddress
                      ? withOpacity(colors.primary, 0.4)
                      : withOpacity('#EF4444', 0.4),
                    padding: spacing[4],
                  },
                ]}
              >
                <View style={styles.addrPanelTop}>
                  <View style={styles.addrPanelLeft}>
                    <Icon
                      name={selectedAddress ? (LABEL_ICON[selectedAddress.label] ?? 'MapPin') as any : 'MapPin'}
                      size={18}
                      color={selectedAddress ? colors.primary : '#EF4444'}
                    />
                    <AppText variant="subhead" weight="semiBold" style={{ marginLeft: 10 }}>
                      Deliver to
                    </AppText>
                  </View>
                  <View style={styles.addrPanelRight}>
                    <AppText variant="caption1" color={colors.primary} weight="semiBold">
                      {selectedAddress ? 'Change' : 'Add Address'}
                    </AppText>
                    <Icon name="ChevronRight" size={14} color={colors.primary} style={{ marginLeft: 2 }} />
                  </View>
                </View>

                {selectedAddress ? (
                  <View style={{ marginTop: 10, paddingLeft: 28 }}>
                    <AppText variant="footnote" weight="semiBold">
                      {selectedAddress.label}
                      {selectedAddress.fullName ? `  ·  ${selectedAddress.fullName}` : ''}
                    </AppText>
                    <AppText variant="caption1" secondary style={{ marginTop: 3, lineHeight: 18 }}>
                      {[selectedAddress.street, selectedAddress.city, selectedAddress.state, selectedAddress.zipCode]
                        .filter(Boolean)
                        .join(', ')}
                    </AppText>
                    {selectedAddress.phone ? (
                      <AppText variant="caption2" secondary style={{ marginTop: 2 }}>
                        📞 {selectedAddress.phone}
                      </AppText>
                    ) : null}
                  </View>
                ) : (
                  <View style={{ marginTop: 8, paddingLeft: 28 }}>
                    <AppText variant="caption1" color="#EF4444">
                      Required — tap to add a delivery address
                    </AppText>
                  </View>
                )}
              </Pressable>

              {/* Bill summary */}
              <View
                style={[
                  styles.billCard,
                  {
                    marginTop: spacing[2],
                    backgroundColor: colors.card,
                    borderRadius: radius.xl,
                    borderColor: withOpacity(colors.border, 0.8),
                    padding: spacing[4],
                  },
                ]}
              >

                <View style={styles.billRow}>
                  <AppText variant="body" secondary>
                    Subtotal (MRP)
                  </AppText>
                  <View style={styles.coinPriceRow}>
                    <Icon name="Coins" size={14} color="#B45309" />
                    <AppText
                      variant="body"
                      weight="semiBold"
                      style={{ marginLeft: 4 }}
                    >
                      {totalMRPCoins.toLocaleString()}
                    </AppText>
                  </View>
                </View>

                {savedCoins > 0 && (
                  <View style={[styles.billRow, { marginTop: spacing[2] }]}>
                    <AppText variant="body" secondary>
                      Discount
                    </AppText>
                    <View style={styles.coinPriceRow}>
                      <Icon name="Coins" size={14} color={colors.success} />
                      <AppText
                        variant="body"
                        weight="semiBold"
                        color={colors.success}
                        style={{ marginLeft: 4 }}
                      >
                        -{savedCoins.toLocaleString()}
                      </AppText>
                    </View>
                  </View>
                )}

                <View
                  style={[
                    styles.billDivider,
                    {
                      backgroundColor: withOpacity(colors.border, 0.8),
                      marginVertical: spacing[3],
                    },
                  ]}
                />

                <View style={styles.billRow}>
                  <AppText variant="title3" weight="semiBold">
                    Total
                  </AppText>
                  <View style={styles.coinPriceRow}>
                    <Icon name="Coins" size={18} color="#B45309" />
                    <AppText
                      variant="title2"
                      weight="bold"
                      color="#92400E"
                      style={{ marginLeft: 6 }}
                    >
                      {totalCoinPrice.toLocaleString()}
                    </AppText>
                  </View>
                </View>

                {/* Coin balance row */}
                <View
                  style={[
                    styles.balanceRow,
                    {
                      marginTop: spacing[3],
                      padding: spacing[3],
                      borderRadius: radius.lg,
                      backgroundColor: hasEnoughCoins
                        ? withOpacity('#22c55e', 0.08)
                        : withOpacity(colors.destructive, 0.08),
                      borderWidth: 1,
                      borderColor: hasEnoughCoins
                        ? withOpacity('#22c55e', 0.25)
                        : withOpacity(colors.destructive, 0.25),
                    },
                  ]}
                >
                  <Icon
                    name={hasEnoughCoins ? 'CheckCircle2' : 'AlertCircle'}
                    size={15}
                    color={hasEnoughCoins ? '#16a34a' : colors.destructive}
                  />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <AppText
                      variant="caption1"
                      weight="semiBold"
                      color={hasEnoughCoins ? '#16a34a' : colors.destructive}
                    >
                      {hasEnoughCoins
                        ? `Balance: ${coinsBalance.toLocaleString()} coins ✓`
                        : `Need ${coinShortfall.toLocaleString()} more coins`}
                    </AppText>
                    {!hasEnoughCoins && (
                      <AppText
                        variant="caption2"
                        secondary
                        style={{ marginTop: 2 }}
                      >
                        Complete your daily step goal to earn coins!
                      </AppText>
                    )}
                  </View>
                </View>
              </View>
            </Fragment>
          }
        />

        {/* ── Sticky footer ── */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(350)}
          style={[
            styles.footer,
            {
              backgroundColor: colors.card,
              borderTopColor: withOpacity(colors.border, 0.9),
              paddingHorizontal: spacing[4],
              paddingTop: spacing[3],
              paddingBottom: spacing[6],
            },
          ]}
        >
          {/* Balance hint chip */}
          <View
            style={[
              styles.footerBalanceChip,
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
              Balance: {coinsBalance.toLocaleString()} coins
            </AppText>
            <View style={{ flex: 1 }} />
            <AppText variant="caption2" color="#B45309">
              Need: {totalCoinPrice.toLocaleString()}
            </AppText>
          </View>

          {/* Checkout button */}
          <Pressable
            onPress={handleCheckout}
            disabled={isPending || !hasEnoughCoins}
            style={[
              styles.checkoutBtn,
              {
                backgroundColor:
                  isPending || !hasEnoughCoins
                    ? colors.mutedForeground
                    : '#92400E',
                borderRadius: radius.xl,
              },
            ]}
          >
            {isPending ? (
              <ActivityIndicator color="#FEF3C7" />
            ) : (
              <>
                <Icon name="Coins" size={20} color="#FEF3C7" />
                <AppText
                  variant="body"
                  weight="bold"
                  color="#FEF3C7"
                  style={{ marginLeft: 8 }}
                >
                  {hasEnoughCoins
                    ? `Pay ${totalCoinPrice.toLocaleString()} Coins`
                    : 'Not Enough Coins'}
                </AppText>
              </>
            )}
          </Pressable>
        </Animated.View>
      </AppView>
    </Screen>
  );
};

export default CartScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },

  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyIconWrap: {
    width: 92,
    height: 92,
    justifyContent: 'center',
    alignItems: 'center',
  },

  shopNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 15,
  },

  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  summaryBar: {
    borderWidth: 1,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  itemCard: {
    flexDirection: 'row',
    borderWidth: 1,
  },

  itemImage: {
    width: 92,
    height: 92,
  },

  itemContent: {
    flex: 1,
    marginLeft: 12,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  categoryChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  deleteBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },

  coinPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  qtyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 4,
  },

  qtyBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  qtyCenter: {
    minWidth: 36,
    alignItems: 'center',
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    borderTopWidth: 1,
  },

  footerBalanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  billCard: {
    borderWidth: 1,
  },

  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  billDivider: {
    height: 1,
  },

  balanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  checkoutBtn: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  addrPanel: {
    borderWidth: 1.5,
  },

  addrPanelTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  addrPanelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  addrPanelRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
