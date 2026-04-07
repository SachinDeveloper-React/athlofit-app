import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useTheme } from '../../../../hooks/useTheme';
import AppText from '../../../../components/AppText';
import { Icon } from '../../../../components/Icon';
import { CoinTransaction } from '../../types/gamification.type';
import { withOpacity } from '../../../../utils/withOpacity';

interface Props {
  item: CoinTransaction;
}

const TransactionItem = ({ item }: Props) => {
  const { colors, spacing, radius } = useTheme();
  
  const isEarned = item.type === 'EARNED';
  const isSpent = item.type === 'SPENT';
  const isExpired = item.type === 'EXPIRED';

  const iconName = isEarned ? 'ArrowUpRight' : isSpent ? 'ArrowDownLeft' : 'Clock';
  const iconColor = isEarned ? colors.success : isSpent ? colors.destructive : colors.mutedForeground;
  const bgColor = withOpacity(iconColor, 0.1);

  return (
    <Animated.View 
      entering={FadeInDown.delay(100)}
      layout={Layout.springify()}
      style={[
        styles.transactionCard, 
        { 
          backgroundColor: colors.card, 
          borderRadius: radius.lg, 
          marginBottom: spacing[2] 
        }
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
        <Icon name={iconName} size={20} color={iconColor} />
      </View>
      <View style={styles.transactionInfo}>
        <AppText variant="label">{item.source}</AppText>
        <AppText variant="caption2" secondary>
          {new Date(item.createdAt).toLocaleDateString()}
        </AppText>
      </View>
      <AppText variant="label" color={iconColor} weight="bold">
        {isEarned ? '+' : '-'}{item.amount}
      </AppText>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionInfo: {
    flex: 1,
    marginLeft: 12,
  },
});

export default TransactionItem;
