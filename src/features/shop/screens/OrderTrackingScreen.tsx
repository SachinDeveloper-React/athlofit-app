import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../hooks/useTheme';
import AppText from '../../../components/AppText';
import { Icon } from '../../../components/Icon';
import { Header } from '../../../components';
import { withOpacity } from '../../../utils/withOpacity';
import { useOrderDetail } from '../hooks/useShop';
import type { ShopStackParamList } from '../../../types/navigation.types';
import { ShopRoutes } from '../../../navigation/routes';
import type { Order, TrackingEvent } from '../types/shop.types';

const { width: SCREEN_W } = Dimensions.get('window');

type RouteT = RouteProp<ShopStackParamList, typeof ShopRoutes.ORDER_TRACKING>;

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { icon: string; color: string; bg: string }> = {
  PENDING:   { icon: 'Clock',        color: '#D97706', bg: '#FEF3C7' },
  PAID:      { icon: 'CheckCircle2', color: '#059669', bg: '#D1FAE5' },
  SHIPPED:   { icon: 'Truck',        color: '#2563EB', bg: '#DBEAFE' },
  DELIVERED: { icon: 'PackageCheck', color: '#7C3AED', bg: '#EDE9FE' },
  CANCELLED: { icon: 'XCircle',      color: '#DC2626', bg: '#FEE2E2' },
};

const STATUS_ORDER = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED'] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

const getDaysRemaining = (estimatedDelivery: string | null) => {
  if (!estimatedDelivery) return null;
  const diff = Math.ceil((new Date(estimatedDelivery).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
};

// ─── Timeline Step ────────────────────────────────────────────────────────────
const TimelineStep = ({
  step,
  isCompleted,
  isActive,
  isLast,
  timestamp,
  description,
  colors,
}: {
  step: { label: string; icon: string; status: string };
  isCompleted: boolean;
  isActive: boolean;
  isLast: boolean;
  timestamp: string | null;
  description: string;
  colors: any;
}) => {
  const meta = STATUS_META[step.status];
  const dotColor = isCompleted || isActive ? meta.color : colors.border;
  const lineColor = isCompleted ? meta.color : colors.border;

  return (
    <View style={styles.timelineRow}>
      {/* Left side: dot + line */}
      <View style={styles.timelineLeft}>
        <View
          style={[
            styles.timelineDot,
            {
              backgroundColor: isCompleted || isActive ? meta.bg : colors.background,
              borderColor: dotColor,
              borderWidth: isCompleted || isActive ? 0 : 2,
            },
          ]}
        >
          {isCompleted || isActive ? (
            <Icon name={step.icon} size={14} color={meta.color} />
          ) : (
            <View style={[styles.dotInner, { backgroundColor: colors.border }]} />
          )}
        </View>
        {!isLast && (
          <View
            style={[
              styles.timelineLine,
              { backgroundColor: lineColor, opacity: isCompleted ? 1 : 0.3 },
            ]}
          />
        )}
      </View>

      {/* Right side: content */}
      <View style={[styles.timelineContent, { paddingBottom: isLast ? 0 : 28 }]}>
        <AppText
          variant="subhead"
          weight={isCompleted || isActive ? 'semiBold' : 'regular'}
          color={isCompleted || isActive ? colors.foreground : colors.mutedForeground}
        >
          {step.label}
        </AppText>
        {timestamp && (
          <AppText variant="caption1" secondary style={{ marginTop: 3 }}>
            {fmtDateTime(timestamp)}
          </AppText>
        )}
        {description !== '' && (
          <AppText variant="caption2" secondary style={{ marginTop: 2 }}>
            {description}
          </AppText>
        )}
      </View>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const OrderTrackingScreen = () => {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteT>();
  const { orderId } = route.params;

  const { data: order, isLoading } = useOrderDetail(orderId);

  // Build timeline from tracking history or fallback to status-based logic
  const timeline = useMemo(() => {
    if (!order) return [];

    const steps = STATUS_ORDER.map(status => ({
      status,
      label: status === 'PENDING' ? 'Order Placed' : status === 'PAID' ? 'Payment Confirmed' : status === 'SHIPPED' ? 'Shipped' : 'Delivered',
      icon: STATUS_META[status].icon,
    }));

    // If cancelled, replace DELIVERED with CANCELLED
    if (order.status === 'CANCELLED') {
      const cancelIdx = steps.findIndex(s => s.status === 'DELIVERED');
      if (cancelIdx !== -1) {
        steps[cancelIdx] = { status: 'CANCELLED', label: 'Cancelled', icon: 'XCircle' };
      }
    }

    return steps.map(step => {
      const historyEntry = order.trackingHistory?.find(h => h.status === step.status);
      const currentIdx = STATUS_ORDER.indexOf(order.status as any);
      const stepIdx = STATUS_ORDER.indexOf(step.status as any);
      const isCompleted = order.status === 'CANCELLED'
        ? (historyEntry != null)
        : stepIdx < currentIdx || (stepIdx === currentIdx && step.status === order.status);
      const isActive = step.status === order.status;

      return {
        ...step,
        isCompleted: isCompleted && !isActive,
        isActive,
        timestamp: historyEntry?.timestamp || null,
        description: historyEntry?.description || '',
      };
    });
  }, [order]);

  if (isLoading || !order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header backLabel="" showBack bordered title="Order Tracking" />
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  const cfg = STATUS_META[order.status] || STATUS_META.PENDING;
  const shortId = order._id.slice(-6).toUpperCase();
  const firstImg = order.items[0]?.product?.images?.[0];
  const daysRemaining = getDaysRemaining(order.estimatedDelivery || null);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header backLabel="" showBack bordered title="Order Tracking" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
      >
        {/* ── Status Hero Card ──────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={[styles.heroCard, { backgroundColor: cfg.bg, borderRadius: 20 }]}
        >
          <View style={[styles.heroIconWrap, { backgroundColor: withOpacity(cfg.color, 0.15) }]}>
            <Icon name={cfg.icon} size={32} color={cfg.color} />
          </View>
          <AppText variant="title3" weight="bold" color={cfg.color} style={{ marginTop: 12 }}>
            {order.status === 'DELIVERED' ? 'Delivered!' :
             order.status === 'SHIPPED' ? 'On the Way' :
             order.status === 'CANCELLED' ? 'Cancelled' :
             order.status === 'PAID' ? 'Order Confirmed' : 'Processing'}
          </AppText>
          <AppText variant="caption1" color={withOpacity(cfg.color, 0.8)} style={{ marginTop: 4 }}>
            Order #{shortId} · {fmtDate(order.createdAt)}
          </AppText>

          {/* Estimated delivery badge */}
          {order.status === 'SHIPPED' && order.estimatedDelivery && daysRemaining !== null && (
            <View style={[styles.etaBadge, { backgroundColor: withOpacity(cfg.color, 0.15), marginTop: 12 }]}>
              <Icon name="Clock" size={12} color={cfg.color} />
              <AppText variant="caption2" weight="semiBold" color={cfg.color} style={{ marginLeft: 5 }}>
                {daysRemaining > 0
                  ? `Arriving in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`
                  : daysRemaining === 0
                  ? 'Arriving today'
                  : 'Delivery delayed'}
              </AppText>
            </View>
          )}

          {/* Delivered date */}
          {order.status === 'DELIVERED' && order.deliveredAt && (
            <View style={[styles.etaBadge, { backgroundColor: withOpacity(cfg.color, 0.15), marginTop: 12 }]}>
              <Icon name="CheckCircle2" size={12} color={cfg.color} />
              <AppText variant="caption2" weight="semiBold" color={cfg.color} style={{ marginLeft: 5 }}>
                Delivered on {fmtDate(order.deliveredAt)}
              </AppText>
            </View>
          )}
        </Animated.View>

        {/* ── Product Summary ──────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(80).duration(380)}
          style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16 }]}
        >
          <AppText variant="subhead" weight="semiBold" style={{ marginBottom: 12 }}>Items</AppText>
          {order.items.map((item, i) => (
            <View key={i} style={[styles.itemRow, i > 0 && { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              {item.product?.images?.[0] ? (
                <Image source={{ uri: item.product.images[0] }} style={[styles.itemThumb, { borderRadius: 10, backgroundColor: withOpacity(colors.primary, 0.06) }]} />
              ) : (
                <View style={[styles.itemThumb, { borderRadius: 10, backgroundColor: withOpacity(colors.primary, 0.06), alignItems: 'center', justifyContent: 'center' }]}>
                  <Icon name="Package" size={18} color={colors.mutedForeground} />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <AppText variant="subhead" weight="medium" numberOfLines={1}>{item.name}</AppText>
                <AppText variant="caption1" secondary style={{ marginTop: 2 }}>
                  Qty: {item.quantity} · {order.paymentMethod === 'COIN_PURCHASE' ? `${item.coinPrice} coins` : `₹${item.price}`}
                </AppText>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* ── Shipping Info ─────────────────────────────────────────────── */}
        {(order.trackingNumber || order.carrier) && (
          <Animated.View
            entering={FadeInDown.delay(140).duration(380)}
            style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16 }]}
          >
            <AppText variant="subhead" weight="semiBold" style={{ marginBottom: 10 }}>Shipping Details</AppText>
            {order.carrier && (
              <View style={styles.infoRow}>
                <Icon name="Truck" size={14} color={colors.mutedForeground} />
                <AppText variant="body" style={{ marginLeft: 10 }}>{order.carrier}</AppText>
              </View>
            )}
            {order.trackingNumber && (
              <View style={[styles.infoRow, { marginTop: 8 }]}>
                <Icon name="Package" size={14} color={colors.mutedForeground} />
                <AppText variant="body" style={{ marginLeft: 10 }}>{order.trackingNumber}</AppText>
              </View>
            )}
            {order.trackingUrl && (
              <Pressable
                onPress={() => Linking.openURL(order.trackingUrl!)}
                style={[styles.trackBtn, { backgroundColor: withOpacity(colors.primary, 0.1), marginTop: 12, borderRadius: 10 }]}
              >
                <Icon name="Globe" size={14} color={colors.primary} />
                <AppText variant="caption1" weight="semiBold" color={colors.primary} style={{ marginLeft: 6 }}>
                  Track on carrier website
                </AppText>
              </Pressable>
            )}
          </Animated.View>
        )}

        {/* ── Delivery Address ─────────────────────────────────────────── */}
        {order.shippingAddress && (
          <Animated.View
            entering={FadeInDown.delay(180).duration(380)}
            style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16 }]}
          >
            <AppText variant="subhead" weight="semiBold" style={{ marginBottom: 10 }}>Delivery Address</AppText>
            <View style={styles.infoRow}>
              <Icon name="MapPin" size={14} color={colors.mutedForeground} />
              <AppText variant="body" secondary style={{ marginLeft: 10, flex: 1 }}>
                {[order.shippingAddress.street, order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.zipCode]
                  .filter(Boolean)
                  .join(', ')}
              </AppText>
            </View>
          </Animated.View>
        )}

        {/* ── Order Timeline ───────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(240).duration(380)}
          style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16 }]}
        >
          <AppText variant="subhead" weight="semiBold" style={{ marginBottom: 16 }}>Order Timeline</AppText>
          {timeline.map((step, i) => (
            <TimelineStep
              key={step.status}
              step={step}
              isCompleted={step.isCompleted}
              isActive={step.isActive}
              isLast={i === timeline.length - 1}
              timestamp={step.timestamp}
              description={step.description}
              colors={colors}
            />
          ))}
        </Animated.View>

        {/* ── Cancellation Reason ──────────────────────────────────────── */}
        {order.status === 'CANCELLED' && order.cancellationReason && (
          <Animated.View
            entering={FadeInDown.delay(300).duration(380)}
            style={[styles.section, { backgroundColor: withOpacity('#DC2626', 0.05), borderColor: withOpacity('#DC2626', 0.2), borderRadius: 16 }]}
          >
            <View style={styles.infoRow}>
              <Icon name="AlertCircle" size={16} color="#DC2626" />
              <AppText variant="subhead" weight="semiBold" color="#DC2626" style={{ marginLeft: 8 }}>
                Cancellation Reason
              </AppText>
            </View>
            <AppText variant="body" secondary style={{ marginTop: 8 }}>
              {order.cancellationReason}
            </AppText>
            {order.cancellationNote && (
              <AppText variant="caption1" secondary style={{ marginTop: 4, fontStyle: 'italic' }}>
                "{order.cancellationNote}"
              </AppText>
            )}
          </Animated.View>
        )}

        {/* ── Order Summary ────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(320).duration(380)}
          style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16 }]}
        >
          <AppText variant="subhead" weight="semiBold" style={{ marginBottom: 10 }}>Order Summary</AppText>
          <View style={styles.summaryRow}>
            <AppText variant="body" secondary>Items ({order.items.reduce((s, i) => s + i.quantity, 0)})</AppText>
            {order.paymentMethod === 'COIN_PURCHASE' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="Coins" size={14} color="#B45309" />
                <AppText variant="body" weight="bold" color="#92400E" style={{ marginLeft: 4 }}>
                  {order.totalCoins.toLocaleString()} Coins
                </AppText>
              </View>
            ) : (
              <AppText variant="body" weight="bold" color={colors.primary}>
                ₹{order.totalPrice.toLocaleString()}
              </AppText>
            )}
          </View>
          <View style={[styles.summaryRow, { marginTop: 6 }]}>
            <AppText variant="body" secondary>Payment Method</AppText>
            <AppText variant="body" weight="medium">
              {order.paymentMethod === 'COIN_PURCHASE' ? 'Coins' : order.paymentMethod === 'RAZORPAY' ? 'Razorpay' : 'Standard'}
            </AppText>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

export default OrderTrackingScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  heroCard: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },

  section: {
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },

  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemThumb: { width: 48, height: 48 },

  infoRow: { flexDirection: 'row', alignItems: 'center' },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // Timeline
  timelineRow: { flexDirection: 'row' },
  timelineLeft: { alignItems: 'center', width: 32 },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: { width: 8, height: 8, borderRadius: 4 },
  timelineLine: { width: 2, flex: 1, marginVertical: 4 },
  timelineContent: { flex: 1, marginLeft: 12, paddingTop: 3 },
});
