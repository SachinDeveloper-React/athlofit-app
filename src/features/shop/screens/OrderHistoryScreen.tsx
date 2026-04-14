// src/features/shop/screens/OrderHistoryScreen.tsx — Advanced Redesign
import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../hooks/useTheme';
import AppText from '../../../components/AppText';
import { Icon } from '../../../components/Icon';
import { withOpacity } from '../../../utils/withOpacity';
import { useOrders, useCancelOrder } from '../hooks/useShop';
import { useGamificationStore } from '../../health/store/gamificationStore';
import type { Order } from '../types/shop.types';

const STATUS_CONFIG: Record<Order['status'], { label: string; icon: string; color: string; bg: string }> = {
  PENDING:   { label: 'Pending',   icon: 'Clock',        color: '#D97706', bg: '#FEF3C7' },
  PAID:      { label: 'Paid',      icon: 'CheckCircle2', color: '#059669', bg: '#D1FAE5' },
  SHIPPED:   { label: 'Shipped',   icon: 'Truck',        color: '#2563EB', bg: '#DBEAFE' },
  DELIVERED: { label: 'Delivered', icon: 'PackageCheck', color: '#7C3AED', bg: '#EDE9FE' },
  CANCELLED: { label: 'Cancelled', icon: 'XCircle',      color: '#DC2626', bg: '#FEE2E2' },
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// ─── Order Card ───────────────────────────────────────────────────────────────
const OrderCard = ({
  order, index, onCancel, isCancelling,
}: {
  order: Order; index: number; onCancel: (id: string) => void; isCancelling: boolean;
}) => {
  const { colors, radius } = useTheme();
  const cfg = STATUS_CONFIG[order.status];
  const isCoin = order.paymentMethod === 'COIN_PURCHASE';
  const shortId = order._id.slice(-6).toUpperCase();
  const canCancel = order.status === 'PENDING' || order.status === 'PAID';
  const firstImg = order.items[0]?.product?.images?.[0];
  const extra = order.items.length - 1;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(380)}
      style={[styles.orderCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 18 }]}
    >
      {/* Top row */}
      <View style={styles.cardTop}>
        <View style={styles.idRow}>
          <View style={[styles.idBadge, { backgroundColor: withOpacity(colors.primary, 0.1) }]}>
            <AppText variant="caption2" weight="bold" color={colors.primary}>#{shortId}</AppText>
          </View>
          {isCoin && (
            <View style={[styles.coinBadge, { backgroundColor: withOpacity('#F5C518', 0.18), marginLeft: 6 }]}>
              <Icon name="Coins" size={11} color="#B45309" />
              <AppText variant="caption2" weight="bold" color="#92400E" style={{ marginLeft: 3 }}>Coins</AppText>
            </View>
          )}
        </View>
        <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
          <Icon name={cfg.icon as any} size={12} color={cfg.color} />
          <AppText variant="caption2" weight="bold" color={cfg.color} style={{ marginLeft: 4 }}>{cfg.label}</AppText>
        </View>
      </View>

      {/* Product row */}
      <View style={[styles.productRow, { marginTop: 14 }]}>
        {firstImg ? (
          <Image source={{ uri: firstImg }} style={[styles.thumb, { borderRadius: 10, backgroundColor: withOpacity(colors.primary, 0.07) }]} />
        ) : (
          <View style={[styles.thumb, { borderRadius: 10, backgroundColor: withOpacity(colors.primary, 0.07), alignItems: 'center', justifyContent: 'center' }]}>
            <Icon name="Package" size={22} color={colors.mutedForeground} />
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <AppText variant="subhead" weight="semiBold" numberOfLines={1}>{order.items[0]?.name ?? 'Product'}</AppText>
          {extra > 0 && <AppText variant="caption1" secondary style={{ marginTop: 2 }}>+{extra} more item{extra > 1 ? 's' : ''}</AppText>}
          {order.shippingAddress?.city && (
            <View style={[styles.addrRow, { marginTop: 4 }]}>
              <Icon name="MapPin" size={11} color={colors.mutedForeground} />
              <AppText variant="caption2" secondary style={{ marginLeft: 4 }} numberOfLines={1}>
                {[order.shippingAddress.city, order.shippingAddress.state].filter(Boolean).join(', ')}
              </AppText>
            </View>
          )}
          <AppText variant="caption2" secondary style={{ marginTop: 4 }}>
            {order.items.reduce((s, i) => s + i.quantity, 0)} unit{order.items.reduce((s, i) => s + i.quantity, 0) > 1 ? 's' : ''} · {fmt(order.createdAt)}
          </AppText>
        </View>
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 14 }]} />

      {/* Total + Cancel */}
      <View style={styles.totalRow}>
        <View>
          <AppText variant="caption1" secondary>Order Total</AppText>
          {isCoin ? (
            <View style={styles.coinLine}>
              <Icon name="Coins" size={15} color="#B45309" />
              <AppText variant="body" weight="bold" color="#92400E" style={{ marginLeft: 5 }}>{order.totalCoins.toLocaleString()} Coins</AppText>
            </View>
          ) : (
            <AppText variant="body" weight="bold" color={colors.primary} style={{ marginTop: 2 }}>₹{order.totalPrice.toLocaleString()}</AppText>
          )}
        </View>
        {canCancel && (
          <Pressable
            onPress={() => onCancel(order._id)}
            disabled={isCancelling}
            style={[styles.cancelBtn, { borderColor: withOpacity('#DC2626', 0.5), opacity: isCancelling ? 0.5 : 1 }]}
          >
            {isCancelling ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <>
                <Icon name="XCircle" size={14} color="#DC2626" />
                <AppText variant="caption1" weight="semiBold" color="#DC2626" style={{ marginLeft: 5 }}>Cancel</AppText>
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
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const setCoinsBalance = useGamificationStore(s => s.setCoinsBalance);
  const coinsBalance = useGamificationStore(s => s.coinsBalance);

  const { mutate: fetchOrders, isPending, data: resData } = useOrders();
  const { mutate: cancelOrderMutate, isPending: isCancelling, variables: cancellingId } = useCancelOrder();

  useEffect(() => { fetchOrders({}); }, []);

  const orders: Order[] = useMemo(() => {
    if (!resData?.success || !resData.data) return [];
    return resData.data.orders;
  }, [resData]);

  const stats = useMemo(() => ({
    total: orders.length,
    coinOrders: orders.filter(o => o.paymentMethod === 'COIN_PURCHASE').length,
    delivered: orders.filter(o => o.status === 'DELIVERED').length,
    pending: orders.filter(o => o.status === 'PENDING' || o.status === 'PAID').length,
  }), [orders]);

  const handleCancel = useCallback((orderId: string) => {
    const order = orders.find(o => o._id === orderId);
    const refundMsg = order?.paymentMethod === 'COIN_PURCHASE' && order.totalCoins > 0
      ? `\n\n💰 ${order.totalCoins.toLocaleString()} coins will be refunded.` : '';
    Alert.alert('Cancel Order?', `Are you sure you want to cancel this order?${refundMsg}`, [
      { text: 'Keep Order', style: 'cancel' },
      {
        text: 'Cancel Order', style: 'destructive',
        onPress: () => cancelOrderMutate(orderId, {
          onSuccess: res => {
            if (res.success) {
              if ((res.data?.refundedCoins ?? 0) > 0) setCoinsBalance(coinsBalance + (res.data?.refundedCoins ?? 0));
              Alert.alert('Order Cancelled', 'Your order has been cancelled successfully.');
              fetchOrders({});
            } else Alert.alert('Failed', res.message || 'Could not cancel order.');
          },
          onError: (err: any) => Alert.alert('Error', err?.message || 'Failed to cancel order.'),
        }),
      },
    ]);
  }, [orders, cancelOrderMutate, fetchOrders, setCoinsBalance, coinsBalance]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="ArrowLeft" size={22} color={colors.foreground} />
        </Pressable>
        <AppText variant="headline" weight="semiBold">My Orders</AppText>
        <View style={{ width: 40 }} />
      </View>

      {isPending ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText variant="body" secondary style={{ marginTop: 12 }}>Loading orders…</AppText>
        </View>
      ) : orders.length === 0 ? (
        <Animated.View entering={FadeInUp.duration(350)} style={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: withOpacity(colors.primary, 0.1) }]}>
            <Icon name="ShoppingBag" size={44} color={colors.primary} />
          </View>
          <AppText variant="title3" weight="bold" style={{ marginTop: 20 }}>No orders yet</AppText>
          <AppText variant="body" secondary align="center" style={{ marginTop: 8, lineHeight: 22, paddingHorizontal: 32 }}>
            Your coin and standard purchases will appear here.
          </AppText>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.shopBtn, { backgroundColor: colors.primary, borderRadius: 16, marginTop: 28 }]}
          >
            <Icon name="ShoppingBag" size={18} color="#fff" />
            <AppText variant="body" weight="bold" color="#fff" style={{ marginLeft: 8 }}>Start Shopping</AppText>
          </Pressable>
        </Animated.View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListHeaderComponent={
            <Animated.View entering={FadeInDown.duration(300)}>
              {/* Stats grid */}
              <View style={[styles.statsGrid, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 16 }]}>
                {[
                  { label: 'Total', value: stats.total, icon: 'Package', color: colors.primary },
                  { label: 'Coin Orders', value: stats.coinOrders, icon: 'Coins', color: '#B45309' },
                  { label: 'Delivered', value: stats.delivered, icon: 'PackageCheck', color: '#7C3AED' },
                  { label: 'Active', value: stats.pending, icon: 'Clock', color: '#D97706' },
                ].map((s, i) => (
                  <View key={s.label} style={[styles.statItem, i < 3 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border }]}>
                    <View style={[styles.statIcon, { backgroundColor: withOpacity(s.color, 0.1) }]}>
                      <Icon name={s.icon as any} size={14} color={s.color} />
                    </View>
                    <AppText variant="title3" weight="bold" style={{ marginTop: 6 }}>{s.value}</AppText>
                    <AppText variant="caption2" secondary style={{ marginTop: 2 }}>{s.label}</AppText>
                  </View>
                ))}
              </View>
            </Animated.View>
          }
          renderItem={({ item, index }) => (
            <OrderCard
              order={item}
              index={index}
              onCancel={handleCancel}
              isCancelling={isCancelling && cancellingId === item._id}
            />
          )}
        />
      )}
    </View>
  );
};

export default OrderHistoryScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center' },
  shopBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 15 },

  statsGrid: {
    flexDirection: 'row', borderRadius: 18, borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
  },
  statItem: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  statIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  orderCard: { borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  idRow: { flexDirection: 'row', alignItems: 'center' },
  idBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  coinBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },

  productRow: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 64, height: 64 },
  addrRow: { flexDirection: 'row', alignItems: 'center' },

  divider: { height: 1 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  coinLine: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderRadius: 10 },
});
