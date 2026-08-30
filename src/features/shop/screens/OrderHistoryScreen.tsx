
import React, { useCallback, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../hooks/useTheme';
import AppText from '../../../components/AppText';
import { Icon } from '../../../components/Icon';
import { withOpacity } from '../../../utils/withOpacity';
import { useOrders, useCancelOrder } from '../hooks/useShop';
import { useGamificationStore } from '../../health/store/gamificationStore';
import type { Order } from '../types/shop.types';
import type { ShopStackParamList } from '../../../types/navigation.types';
import { ShopRoutes } from '../../../navigation/routes';
import { Header } from '../../../components';
import CancelOrderModal from '../components/CancelOrderModal';

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
  order, index, onCancel, onTrack, isCancelling,
}: {
  order: Order; index: number; onCancel: (id: string) => void; onTrack: (id: string) => void; isCancelling: boolean;
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
          <Image source={{ uri: firstImg }} style={[styles.thumb, { borderRadius: 10, backgroundColor: withOpacity(colors.primary, 0.07) }]} resizeMethod="resize" />
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

      {/* Total + Actions */}
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
      </View>

      {/* Action buttons row */}
      <View style={[styles.actionsRow, { marginTop: 12 }]}>
        {/* Track Order button — always visible */}
        <Pressable
          onPress={() => onTrack(order._id)}
          style={[styles.trackBtn, { backgroundColor: withOpacity(colors.primary, 0.1), borderRadius: 10 }]}
        >
          <Icon name="Truck" size={14} color={colors.primary} />
          <AppText variant="caption1" weight="semiBold" color={colors.primary} style={{ marginLeft: 5 }}>Track Order</AppText>
        </Pressable>

        {/* Cancel button — only for PENDING/PAID */}
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
  const navigation = useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const setCoinsBalance = useGamificationStore(s => s.setCoinsBalance);
  const coinsBalance = useGamificationStore(s => s.coinsBalance);

  // Cancel modal state
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  const {
    data: ordersData,
    isLoading: isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch: refetchOrders,
    isRefetching,
  } = useOrders();
  const { mutate: cancelOrderMutate, isPending: isCancelling, variables: cancellingId } = useCancelOrder();

  const orders: Order[] = useMemo(() => ordersData?.orders ?? [], [ordersData]);

  const stats = useMemo(() => ({
    total:      ordersData?.total ?? 0,
    coinOrders: orders.filter(o => o.paymentMethod === 'COIN_PURCHASE').length,
    delivered:  orders.filter(o => o.status === 'DELIVERED').length,
    pending:    orders.filter(o => o.status === 'PENDING' || o.status === 'PAID').length,
  }), [orders, ordersData?.total]);

  // Get the order being cancelled (for modal info)
  const cancellingOrder = useMemo(
    () => orders.find(o => o._id === cancellingOrderId),
    [orders, cancellingOrderId],
  );

  const handleCancelPress = useCallback((orderId: string) => {
    setCancellingOrderId(orderId);
    setCancelModalVisible(true);
  }, []);

  const handleCancelConfirm = useCallback((reason: string, note: string) => {
    if (!cancellingOrderId) return;
    cancelOrderMutate(
      { orderId: cancellingOrderId, reason, note },
      {
        onSuccess: res => {
          setCancelModalVisible(false);
          setCancellingOrderId(null);
          if (res.success) {
            if ((res.data?.refundedCoins ?? 0) > 0) setCoinsBalance(coinsBalance + (res.data?.refundedCoins ?? 0));
            Alert.alert('Order Cancelled', 'Your order has been cancelled successfully.');
          } else {
            Alert.alert('Failed', res.message || 'Could not cancel order.');
          }
        },
        onError: (err: any) => {
          setCancelModalVisible(false);
          setCancellingOrderId(null);
          Alert.alert('Error', err?.message || 'Failed to cancel order.');
        },
      },
    );
  }, [cancellingOrderId, cancelOrderMutate, setCoinsBalance, coinsBalance]);

  const handleTrack = useCallback((orderId: string) => {
    navigation.navigate(ShopRoutes.ORDER_TRACKING, { orderId });
  }, [navigation]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header backLabel='' showBack bordered title='My Orders'/>
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
          // ── Pagination ────────────────────────────────────────────────
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          // ── Pull-to-refresh ───────────────────────────────────────────
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={refetchOrders}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <Animated.View entering={FadeInDown.duration(300)}>
              <View style={[styles.statsGrid, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 16 }]}>
                {[
                  { label: 'Total',       value: stats.total,      icon: 'Package',      color: colors.primary },
                  { label: 'Coin Orders', value: stats.coinOrders, icon: 'Coins',        color: '#B45309'      },
                  { label: 'Delivered',   value: stats.delivered,  icon: 'PackageCheck', color: '#7C3AED'      },
                  { label: 'Active',      value: stats.pending,    icon: 'Clock',        color: '#D97706'      },
                ].map((s, i) => (
                  <View key={s.label} style={[styles.statItem, i < 3 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border }]}>
                    <View style={[styles.statIcon, { backgroundColor: withOpacity(s.color, 0.12) }]}>
                      <Icon name={s.icon as any} size={15} color={s.color} />
                    </View>
                    <AppText variant="subhead" weight="bold" style={{ marginTop: 6 }}>{s.value}</AppText>
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
              onCancel={handleCancelPress}
              onTrack={handleTrack}
              isCancelling={isCancelling && cancellingId?.orderId === item._id}
            />
          )}
        />
      )}

      {/* Cancel Order Modal */}
      <CancelOrderModal
        visible={cancelModalVisible}
        onClose={() => { setCancelModalVisible(false); setCancellingOrderId(null); }}
        onConfirm={handleCancelConfirm}
        isLoading={isCancelling}
        orderCoins={cancellingOrder?.paymentMethod === 'COIN_PURCHASE' ? cancellingOrder.totalCoins : undefined}
      />
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
    flexDirection: 'row', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
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

  actionsRow: { flexDirection: 'row', gap: 8 },
  trackBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, flex: 1, justifyContent: 'center' },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderRadius: 10 },
});
