import React from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
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

// Map category to a relevant icon
const getCategoryIcon = (category?: TransactionCategory, type?: string): string => {
  if (category) {
    switch (category) {
      case 'PASSIVE_STEPS':
        return 'Footprints';
      case 'DAILY_STEP_GOAL':
      case 'DAILY_STEP_GOAL_AUTO':
        return 'Target';
      case 'HYDRATION_GOAL':
        return 'Droplets';
      case 'STREAK_BADGE':
        return 'Flame';
      case 'ACHIEVEMENT':
        return 'Trophy';
      case 'CHALLENGE':
        return 'Swords';
      case 'REFERRAL_BONUS':
        return 'UserPlus';
      case 'SHOP_PURCHASE':
        return 'ShoppingBag';
      case 'SHOP_REFUND':
        return 'RotateCcw';
      default:
        return 'Circle';
    }
  }
  // Fallback based on type
  if (type === 'EARNED') return 'ArrowUpRight';
  if (type === 'SPENT') return 'ArrowDownLeft';
  return 'Clock';
};

// Format date as relative or absolute
const formatTransactionDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

const TransactionItem = ({ item }: Props) => {
  const { colors, spacing, radius } = useTheme();
  const styles = useStyles();

  const isEarned = item.type === 'EARNED';
  const isSpent = item.type === 'SPENT';

  const iconName = getCategoryIcon(item.category, item.type);
  const iconColor = isEarned ? colors.success : isSpent ? colors.destructive : colors.mutedForeground;
  const bgColor = withOpacity(iconColor, 0.1);

  // Format amount with proper precision
  const formattedAmount = item.amount < 1
    ? item.amount.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
    : item.amount.toFixed(2).replace(/\.00$/, '');

  return (
    <Animated.View layout={Layout.springify()}>
      <Animated.View
        entering={FadeInDown.delay(100)}
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
      </Animated.View>
    </Animated.View>
  );
};

export default TransactionItem;
