import React, { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../hooks/useTheme';
import AppText from '../../../../components/AppText';
import { Icon } from '../../../../components/Icon';
import { CoinTransaction, TransactionCategory } from '../../types/gamification.type';
import { withOpacity } from '../../../../utils/withOpacity';
import { makeStyles } from '../../../../hooks/makeStyles';

interface Props {
  item: CoinTransaction;
}

const useStyles = makeStyles(({ colors, spacing, radius }) => ({
  transactionCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: spacing[3],
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  transactionInfo: {
    flex: 1,
    marginLeft: spacing[3],
  },
  amountRow: {
    alignItems: 'flex-end' as const,
  },
}));

// ─── Category Helpers ─────────────────────────────────────────────────────────

const getCategoryIcon = (category?: TransactionCategory, type?: string): string => {
  if (category) {
    switch (category) {
      case 'PASSIVE_STEPS':
      case 'PASSIVE_STEPS_RETRO':
        return 'Footprints';
      case 'DAILY_STEP_GOAL':
      case 'DAILY_STEP_GOAL_AUTO':
      case 'DAILY_STEP_GOAL_RETRO':
        return 'Target';
      case 'HYDRATION_GOAL':
        return 'Droplets';
      case 'STREAK_BADGE':
        return 'Flame';
      case 'ACHIEVEMENT':
        return 'Trophy';
      case 'CHALLENGE':
        return 'Swords';
      // Clawbacks share an icon with the refund they resemble — the amount is
      // already negative, so the row does not also need a distinct symbol.
      case 'HYDRATION_GOAL_REVERTED':
      case 'CHALLENGE_REVERTED':
        return 'RefreshCw';
      case 'REFERRAL_BONUS':
        return 'Gift';
      case 'SHOP_PURCHASE':
        return 'ShoppingBag';
      case 'SHOP_REFUND':
        return 'RefreshCw';
      default:
        return 'Circle';
    }
  }
  if (type === 'EARNED') return 'TrendingUp';
  if (type === 'SPENT') return 'TrendingDown';
  return 'Clock';
};

const getCategoryLabel = (category?: TransactionCategory): string => {
  switch (category) {
    case 'PASSIVE_STEPS': return 'Passive Step Earnings';
    case 'PASSIVE_STEPS_RETRO': return 'Passive Step Earnings (Backdated)';
    case 'DAILY_STEP_GOAL': return 'Daily Step Goal Reward';
    case 'DAILY_STEP_GOAL_AUTO': return 'Daily Step Goal (Auto)';
    case 'DAILY_STEP_GOAL_RETRO': return 'Daily Step Goal (Backdated)';
    case 'HYDRATION_GOAL': return 'Hydration Goal Reward';
    case 'HYDRATION_GOAL_REVERTED': return 'Hydration Reward Reversed';
    case 'STREAK_BADGE': return 'Streak Badge Bonus';
    case 'ACHIEVEMENT': return 'Achievement Reward';
    case 'CHALLENGE': return 'Challenge Completed';
    case 'CHALLENGE_REVERTED': return 'Challenge Reward Reversed';
    case 'REFERRAL_BONUS': return 'Referral Bonus';
    case 'SHOP_PURCHASE': return 'Shop Purchase';
    case 'SHOP_REFUND': return 'Order Refund';
    case 'MANUAL': return 'Manual Adjustment';
    default: return 'Coin Transaction';
  }
};

const getCategoryExplanation = (category?: TransactionCategory, type?: string): string => {
  switch (category) {
    case 'PASSIVE_STEPS':
      // The three-hour logging throttle this used to describe was removed —
      // every award writes its own row now — so the sentence was telling users
      // to expect gaps that no longer exist.
      return 'You earn coins passively as you walk. Every 100 steps earns coins at the configured rate, and each award is logged here as it happens.';
    case 'PASSIVE_STEPS_RETRO':
      return 'Coins for steps on an earlier day that had not been counted yet — usually because your phone was offline or the app was closed. Only the steps that were not already paid for are added.';
    case 'DAILY_STEP_GOAL':
    case 'DAILY_STEP_GOAL_AUTO':
      return 'You hit your daily step goal! This bonus is awarded once per day when you reach your target steps.';
    case 'DAILY_STEP_GOAL_RETRO':
      return 'Your step goal bonus for an earlier day, awarded once that day\'s steps finally synced. It is still paid only once for that day.';
    case 'HYDRATION_GOAL':
      return 'You completed your daily water intake goal. Stay hydrated to earn coins every day!';
    case 'HYDRATION_GOAL_REVERTED':
      return 'Your water intake was reset below the daily goal, so the hydration reward for that day was taken back.';
    case 'CHALLENGE_REVERTED':
      return 'Progress on a completed challenge was revised downward, so its reward was taken back.';
    case 'STREAK_BADGE':
      return 'You maintained a consistent activity streak and unlocked a badge milestone. Longer streaks earn bigger rewards.';
    case 'ACHIEVEMENT':
      return 'You completed an advanced achievement challenge. These are special milestones that reward significant progress.';
    case 'CHALLENGE':
      return 'You completed a fitness, nutrition, or hydration challenge. Check the Challenges section for more ways to earn.';
    case 'REFERRAL_BONUS':
      return 'A friend joined using your referral code. You both earn bonus coins when they sign up!';
    case 'SHOP_PURCHASE':
      return 'Coins spent on a product in the shop. You can buy real products using only your earned fitness coins.';
    case 'SHOP_REFUND':
      return 'Coins refunded from a cancelled or returned order. The full amount has been credited back.';
    case 'MANUAL':
      return 'This was a manual adjustment by the admin team.';
    default:
      if (type === 'EARNED') return 'Coins earned through your fitness activity.';
      if (type === 'SPENT') return 'Coins spent on a reward or purchase.';
      return 'A coin transaction on your account.';
  }
};

// Format date — shows full date + time with relative duration
const formatTransactionDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Relative label
  let relative = '';
  if (diffMins < 1) relative = 'Just now';
  else if (diffMins < 60) relative = `${diffMins}m`;
  else if (diffHours < 24) relative = `${diffHours}h`;
  else if (diffDays < 30) relative = `${diffDays}d`;
  else relative = `${Math.floor(diffDays / 30)}mo`;

  // Full date + time: "Sat 11 Jul 2026 1:26:00 AM"
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const fullDate = `${dayName} ${day} ${month} ${year} ${time}`;

  if (relative === 'Just now') return `${fullDate} (now)`;
  return `${fullDate} (${relative})`;
};

const formatFullDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ─── Detail Popup ─────────────────────────────────────────────────────────────

interface DetailPopupProps {
  visible: boolean;
  onClose: () => void;
  item: CoinTransaction;
}

const DetailPopup = ({ visible, onClose, item }: DetailPopupProps) => {
  const { colors, isDark } = useTheme();

  const isEarned = item.type === 'EARNED';
  const isSpent = item.type === 'SPENT';
  const iconName = getCategoryIcon(item.category, item.type);
  const accentColor = isEarned ? colors.success : isSpent ? colors.destructive : colors.primary;

  const formattedAmount = item.amount < 1
    ? item.amount.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
    : item.amount.toFixed(2).replace(/\.00$/, '');

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={popupStyles.backdrop} onPress={onClose} />
      <View style={[popupStyles.sheet, { backgroundColor: colors.card }]}>
        {/* Handle */}
        <View style={[popupStyles.handle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={popupStyles.header}>
          <View style={[popupStyles.iconCircle, { backgroundColor: withOpacity(accentColor, 0.12) }]}>
            <Icon name={iconName as any} size={24} color={accentColor} />
          </View>
          <View style={popupStyles.headerText}>
            <AppText variant="headline" weight="bold">
              {getCategoryLabel(item.category)}
            </AppText>
            <AppText variant="caption1" color={colors.mutedForeground}>
              {formatFullDate(item.createdAt)}
            </AppText>
          </View>
        </View>

        {/* Amount */}
        <View style={[popupStyles.amountCard, { backgroundColor: withOpacity(accentColor, 0.06), borderColor: withOpacity(accentColor, 0.15) }]}>
          <AppText variant="caption1" color={colors.mutedForeground}>
            {isEarned ? 'Earned' : isSpent ? 'Spent' : 'Amount'}
          </AppText>
          <AppText variant="title1" weight="bold" color={accentColor}>
            {isEarned ? '+' : '-'}{formattedAmount} coins
          </AppText>
          {item.balanceAfter != null && (
            <AppText variant="caption2" color={colors.mutedForeground}>
              Balance after: {item.balanceAfter.toFixed(2)} coins
            </AppText>
          )}
        </View>

        {/* Description (full, no truncation) */}
        <View style={popupStyles.section}>
          <AppText variant="caption1" weight="semiBold" color={colors.mutedForeground} style={popupStyles.sectionLabel}>
            Description
          </AppText>
          <AppText variant="subhead" style={{ lineHeight: 22 }}>
            {item.source}
          </AppText>
        </View>

        {/* How you earned / why it's here */}
        <View style={[popupStyles.explainCard, { backgroundColor: withOpacity(colors.primary, 0.04), borderColor: withOpacity(colors.primary, 0.1) }]}>
          <View style={popupStyles.explainHeader}>
            <Icon name="LifeBuoy" size={14} color={colors.primary} />
            <AppText variant="caption1" weight="semiBold" color={colors.primary}>
              {isEarned ? 'How you earned this' : isSpent ? 'Why coins were deducted' : 'About this transaction'}
            </AppText>
          </View>
          <AppText variant="caption1" color={colors.mutedForeground} style={{ lineHeight: 20, marginTop: 6 }}>
            {getCategoryExplanation(item.category, item.type)}
          </AppText>
        </View>

        {/* Close button */}
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.8}
          style={[popupStyles.closeBtn, { backgroundColor: colors.primary }]}
        >
          <AppText variant="subhead" weight="bold" color="#fff">
            Got it
          </AppText>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const TransactionItem = ({ item }: Props) => {
  const { colors, spacing, radius } = useTheme();
  const styles = useStyles();
  const [showDetail, setShowDetail] = useState(false);

  const isEarned = item.type === 'EARNED';
  const isSpent = item.type === 'SPENT';

  const iconName = getCategoryIcon(item.category, item.type);
  const iconColor = isEarned ? colors.success : isSpent ? colors.destructive : colors.mutedForeground;
  const bgColor = withOpacity(iconColor, 0.1);

  const formattedAmount = item.amount < 1
    ? item.amount.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
    : item.amount.toFixed(2).replace(/\.00$/, '');

  const handlePress = useCallback(() => setShowDetail(true), []);

  return (
    <>
      <View>
        <Pressable onPress={handlePress}>
          <View
            style={[
              styles.transactionCard,
              {
                backgroundColor: colors.card,
                borderRadius: radius.lg,
                marginBottom: spacing[2],
              },
            ]}
          >
            <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
              <Icon name={iconName as any} size={20} color={iconColor} />
            </View>
            <View style={styles.transactionInfo}>
              <AppText variant="label" numberOfLines={1}>{item.source}</AppText>
              <AppText variant="caption2" secondary>
                {formatTransactionDate(item.createdAt)}
              </AppText>
            </View>
            <View style={styles.amountRow}>
              <AppText variant="label" color={iconColor} weight="bold">
                {isEarned ? '+' : '-'}{formattedAmount}
              </AppText>
              {item.balanceAfter != null && (
                <AppText variant="caption2" secondary>
                  bal: {item.balanceAfter.toFixed(2)}
                </AppText>
              )}
            </View>
          </View>
        </Pressable>
      </View>

      <DetailPopup
        visible={showDetail}
        onClose={() => setShowDetail(false)}
        item={item}
      />
    </>
  );
};

export default TransactionItem;

// ─── Popup Styles ─────────────────────────────────────────────────────────────

const popupStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 34,
    gap: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  amountCard: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 4,
  },
  section: {
    gap: 4,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  explainCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  explainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  closeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
});
