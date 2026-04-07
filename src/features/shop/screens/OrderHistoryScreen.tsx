// src/features/shop/screens/OrderHistoryScreen.tsx
import React, { useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { useTheme } from '../../../hooks/useTheme';
import { AppView, AppText, Screen, Header, Icon } from '../../../components';
import { useOrders, useCancelOrder } from '../hooks/useShop';
import { withOpacity } from '../../../utils/withOpacity';
import { useGamificationStore } from '../../health/store/gamificationStore';
import type { Order } from '../types/shop.types';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  Order['status'],
  { label: string; icon: string; color: string; bgColor: string }
> = {
  PENDING:   { label: 'Pending',   icon: 'Clock',         color: '#D97706', bgColor: '#FEF3C7' },
  PAID:      { label: 'Paid',      icon: 'CheckCircle2',  color: '#059669', bgColor: '#D1FAE5' },
  SHIPPED:   { label: 'Shipped',   icon: 'Truck',         color: '#2563EB', bgColor: '#DBEAFE' },
  DELIVERED: { label: 'Delivered', icon: 'PackageCheck',  color: '#7C3AED', bgColor: '#EDE9FE' },
  CANCELLED: { label: 'Cancelled', icon: 'XCircle',       color: '#DC2626', bgColor: '#FEE2E2' },
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// ─── OrderCard ────────────────────────────────────────────────────────────────
const OrderCard = ({
  order,
  index,
  onCancel,
  isCancelling,
}: {
  order: Order;
  index: number;
  onCancel: (orderId: string) => void;
  isCancelling: boolean;
}) => {
  const { colors, spacing, radius } = useTheme();
  const statusCfg = STATUS_CONFIG[order.status];
  const isCoinOrder = order.paymentMethod === 'COIN_PURCHASE';
  const shortId = order._id.slice(-6).toUpperCase();
  const canCancel = order.status === 'PENDING' || order.status === 'PAID';

  const firstImage = order.items[0]?.product?.images?.[0];
  const extraCount = order.items.length - 1;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(380)}
      style={[
        styles.orderCard,
        {
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          borderColor: withOpacity(colors.border, 0.8),
          padding: spacing[4],
        },
      ]}
    >
      {/* ── Header row ── */}
      <View style={styles.cardHeader}>
        <View style={styles.orderIdRow}>
          <View
            style={[
              styles.orderIdBadge,
              {
                backgroundColor: withOpacity(colors.primary, 0.1),
                borderRadius: radius.md,
              },
            ]}
          >
            <AppText variant="caption2" weight="bold" color={colors.primary}>
              #{shortId}
            </AppText>
          </View>
          {isCoinOrder && (
            <View
              style={[
                styles.coinBadge,
                {
                  backgroundColor: withOpacity('#F5C518', 0.18),
                  borderRadius: radius.md,
                  marginLeft: spacing[2],
                },
              ]}
            >
              <Icon name="Coins" size={11} color="#B45309" />
              <AppText
                variant="caption2"
                weight="bold"
                color="#92400E"
                style={{ marginLeft: 4 }}
              >
                Coins
              </AppText>
            </View>
          )}
        </View>

        {/* Status pill */}
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: statusCfg.bgColor,
              borderRadius: radius.full ?? 999,
            },
          ]}
        >
          <Icon name={statusCfg.icon as any} size={12} color={statusCfg.color} />
          <AppText
            variant="caption2"
            weight="bold"
            color={statusCfg.color}
            style={{ marginLeft: 4 }}
          >
            {statusCfg.label}
          </AppText>
        </View>
      </View>

      {/* ── Product thumbnails ── */}
      <View style={[styles.thumbsRow, { marginTop: spacing[3] }]}>
        {firstImage ? (
          <Image
            source={{ uri: firstImage }}
            style={[
              styles.thumb,
              {
                borderRadius: radius.lg,
                backgroundColor: withOpacity(colors.primary, 0.07),
              },
            ]}
          />
        ) : (
          <View
            style={[
              styles.thumb,
              {
                borderRadius: radius.lg,
                backgroundColor: withOpacity(colors.primary, 0.07),
                alignItems: 'center',
                justifyContent: 'center',
              },
            ]}
          >
            <Icon name="Package" size={22} color={colors.mutedForeground} />
          </View>
        )}

        <View style={{ flex: 1, marginLeft: spacing[3] }}>
          <AppText variant="subhead" weight="semiBold" numberOfLines={1}>
            {order.items[0]?.name ?? 'Product'}
          </AppText>
          {extraCount > 0 && (
            <AppText variant="caption1" secondary style={{ marginTop: 2 }}>
              +{extraCount} more item{extraCount > 1 ? 's' : ''}
            </AppText>
          )}

          {/* Delivery address if present */}
          {order.shippingAddress?.city ? (
            <View style={[styles.addressRow, { marginTop: spacing[1] }]}>
              <Icon name="MapPin" size={11} color={colors.mutedForeground} />
              <AppText variant="caption2" secondary style={{ marginLeft: 4 }} numberOfLines={1}>
                {[order.shippingAddress.city, order.shippingAddress.state]
                  .filter(Boolean)
                  .join(', ')}
              </AppText>
            </View>
          ) : null}

          <AppText variant="caption1" secondary style={{ marginTop: 4 }}>
            {order.items.reduce((s, i) => s + i.quantity, 0)} unit
            {order.items.reduce((s, i) => s + i.quantity, 0) > 1 ? 's' : ''}
            {' · '}
            {formatDate(order.createdAt)}
          </AppText>
        </View>
      </View>

      {/* ── Divider ── */}
      <View
        style={[
          styles.divider,
          { backgroundColor: withOpacity(colors.border, 0.8), marginVertical: spacing[3] },
        ]}
      />

      {/* ── Total + Cancel ── */}
      <View style={styles.totalRow}>
        <View>
          <AppText variant="caption1" secondary>
            Order Total
          </AppText>
          {isCoinOrder ? (
            <View style={[styles.coinLine, { marginTop: 2 }]}>
              <Icon name="Coins" size={15} color="#B45309" />
              <AppText variant="body" weight="bold" color="#92400E" style={{ marginLeft: 6 }}>
                {order.totalCoins.toLocaleString()} Coins
              </AppText>
            </View>
          ) : (
            <AppText variant="body" weight="bold" color={colors.primary} style={{ marginTop: 2 }}>
              ₹{order.totalPrice.toLocaleString()}
            </AppText>
          )}
        </View>

        {/* Cancel button — only for PENDING / PAID */}
        {canCancel && (
          <Pressable
            onPress={() => onCancel(order._id)}
            disabled={isCancelling}
            style={[
              styles.cancelBtn,
              {
                borderColor: withOpacity('#DC2626', 0.6),
                borderRadius: radius.lg,
                opacity: isCancelling ? 0.5 : 1,
              },
            ]}
          >
            {isCancelling ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <>
                <Icon name="XCircle" size={14} color="#DC2626" />
                <AppText
                  variant="caption1"
                  weight="semiBold"
                  color="#DC2626"
                  style={{ marginLeft: 5 }}
                >
                  Cancel
                </AppText>
              </>
            )}
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const OrderHistoryScreen = () => {
  const { colors, spacing, radius } = useTheme();
  const navigation = useNavigation();
  const setCoinsBalance = useGamificationStore(s => s.setCoinsBalance);
  const coinsBalance = useGamificationStore(s => s.coinsBalance);

  const { mutate: fetchOrders, isPending, data: resData } = useOrders();
  const { mutate: cancelOrderMutate, isPending: isCancelling, variables: cancellingId } =
    useCancelOrder();

  useEffect(() => {
    fetchOrders({});
  }, [fetchOrders]);

  const orders: Order[] = useMemo(() => {
    if (!resData?.success || !resData.data) return [];
    return resData.data.orders;
  }, [resData]);

  const coinOrderCount = useMemo(
    () => orders.filter(o => o.paymentMethod === 'COIN_PURCHASE').length,
    [orders],
  );

  const handleCancel = useCallback(
    (orderId: string) => {
      const order = orders.find(o => o._id === orderId);
      const refundMsg =
        order?.paymentMethod === 'COIN_PURCHASE' && order.totalCoins > 0
          ? `\n\n💰 ${order.totalCoins.toLocaleString()} coins will be refunded.`
          : '';

      Alert.alert(
        'Cancel Order?',
        `Are you sure you want to cancel this order?${refundMsg}`,
        [
          { text: 'Keep Order', style: 'cancel' },
          {
            text: 'Cancel Order',
            style: 'destructive',
            onPress: () => {
              cancelOrderMutate(orderId, {
                onSuccess: res => {
                  if (res.success) {
                    // Refund coins to local store immediately
                    if ((res.data?.refundedCoins ?? 0) > 0) {
                      setCoinsBalance(coinsBalance + (res.data?.refundedCoins ?? 0));
                    }
                    Alert.alert('Order Cancelled', 'Your order has been cancelled successfully.');
                    fetchOrders({});
                  } else {
                    Alert.alert('Failed', res.message || 'Could not cancel order.');
                  }
                },
                onError: (err: any) => {
                  Alert.alert('Error', err?.message || 'Failed to cancel order.');
                },
              });
            },
          },
        ],
      );
    },
    [orders, cancelOrderMutate, fetchOrders, setCoinsBalance, coinsBalance],
  );

  return (
    <Screen padded={false} safeArea={false}>
      <AppView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header showBack title="My Orders" bordered backLabel="" />

        {isPending ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <AppText variant="body" secondary style={{ marginTop: spacing[3] }}>
              Loading your orders…
            </AppText>
          </View>
        ) : orders.length === 0 ? (
          /* ── Empty State ── */
          <Animated.View
            entering={FadeInUp.duration(350)}
            style={[styles.emptyWrap, { paddingHorizontal: spacing[6] }]}
          >
            <View
              style={[
                styles.emptyIconWrap,
                {
                  backgroundColor: withOpacity(colors.primary, 0.1),
                  borderRadius: 999,
                },
              ]}
            >
              <Icon name="ShoppingBag" size={42} color={colors.primary} />
            </View>

            <AppText variant="title3" weight="bold" style={{ marginTop: spacing[4] }}>
              No orders yet
            </AppText>

            <AppText
              variant="body"
              secondary
              align="center"
              style={{ marginTop: spacing[2], lineHeight: 22 }}
            >
              Your coin and standard purchases will appear here once you place
              your first order.
            </AppText>

            <Pressable
              onPress={() => navigation.goBack()}
              style={[
                styles.shopNowBtn,
                {
                  backgroundColor: colors.primary,
                  borderRadius: radius.xl,
                  marginTop: spacing[6],
                },
              ]}
            >
              <Icon name="ShoppingBag" size={18} color="#fff" />
              <AppText
                variant="body"
                weight="semiBold"
                color="#fff"
                style={{ marginLeft: 8 }}
              >
                Start Shopping
              </AppText>
            </Pressable>
          </Animated.View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={item => item._id}
            renderItem={({ item, index }) => (
              <OrderCard
                order={item}
                index={index}
                onCancel={handleCancel}
                isCancelling={isCancelling && cancellingId === item._id}
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              padding: spacing[4],
              paddingBottom: spacing[8],
            }}
            ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
            ListHeaderComponent={
              <Animated.View entering={FadeInUp.duration(350)}>
                {/* Stats bar */}
                <View
                  style={[
                    styles.statsBar,
                    {
                      marginBottom: spacing[4],
                      backgroundColor: colors.card,
                      borderRadius: radius.xl,
                      borderColor: withOpacity(colors.border, 0.8),
                      padding: spacing[4],
                    },
                  ]}
                >
                  <View style={styles.statItem}>
                    <AppText variant="title3" weight="bold">
                      {orders.length}
                    </AppText>
                    <AppText variant="caption1" secondary style={{ marginTop: 2 }}>
                      Total Orders
                    </AppText>
                  </View>

                  <View
                    style={[
                      styles.statDivider,
                      { backgroundColor: withOpacity(colors.border, 0.8) },
                    ]}
                  />

                  <View style={styles.statItem}>
                    <View style={styles.coinLine}>
                      <Icon name="Coins" size={16} color="#B45309" />
                      <AppText
                        variant="title3"
                        weight="bold"
                        color="#92400E"
                        style={{ marginLeft: 4 }}
                      >
                        {coinOrderCount}
                      </AppText>
                    </View>
                    <AppText variant="caption1" secondary style={{ marginTop: 2 }}>
                      Coin Purchases
                    </AppText>
                  </View>

                  <View
                    style={[
                      styles.statDivider,
                      { backgroundColor: withOpacity(colors.border, 0.8) },
                    ]}
                  />

                  <View style={styles.statItem}>
                    <AppText variant="title3" weight="bold">
                      {orders.filter(o => o.status === 'DELIVERED').length}
                    </AppText>
                    <AppText variant="caption1" secondary style={{ marginTop: 2 }}>
                      Delivered
                    </AppText>
                  </View>
                </View>
              </Animated.View>
            }
          />
        )}
      </AppView>
    </Screen>
  );
};

export default OrderHistoryScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

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

  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },

  statItem: {
    flex: 1,
    alignItems: 'center',
  },

  statDivider: {
    width: 1,
    height: 36,
    marginHorizontal: 8,
  },

  orderCard: {
    borderWidth: 1,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  orderIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  orderIdBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  thumbsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  thumb: {
    width: 64,
    height: 64,
  },

  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  divider: {
    height: 1,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  coinLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
});
