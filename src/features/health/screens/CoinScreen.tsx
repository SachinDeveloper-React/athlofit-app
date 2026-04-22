import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  ListRenderItem,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  LinearTransition,
} from 'react-native-reanimated';

import { useTheme } from '../../../hooks/useTheme';
import AppView from '../../../components/AppView';
import AppText from '../../../components/AppText';
import Screen from '../../../components/Screen';
import { Icon } from '../../../components/Icon';
import { Header } from '../../../components';

import { useCoinData } from '../hooks/useGamification';
import { CoinTransaction, ClaimableReward } from '../types/gamification.type';
import { withOpacity } from '../../../utils/withOpacity';
import TransactionItem from '../components/coins/TransactionItem';
import ClaimableItem from '../components/coins/ClaimableItem';
import { useGamificationStore } from '../store/gamificationStore';
import { formatCoins } from '../../../config/appConfig';

type TabKey = 'TRANSACTIONS' | 'REWARDS';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'TRANSACTIONS', label: 'History', icon: 'Clock3' },
  { key: 'REWARDS', label: 'Earn Coins', icon: 'Gift' },
];

const CoinScreen = () => {
  const { colors, spacing, radius } = useTheme();
  const { data, isLoading } = useCoinData();
  const [activeTab, setActiveTab] = useState<TabKey>('TRANSACTIONS');

  // Zustand is the single source of truth for balance across all screens
  const coinsBalance = useGamificationStore(s => s.coinsBalance);
  const setCoinsBalance = useGamificationStore(s => s.setCoinsBalance);

  // When API responds, sync latest balance to the store
  useEffect(() => {
    if (data?.balance != null && data.balance !== coinsBalance) {
      setCoinsBalance(data.balance);
    }
  }, [data?.balance]);

  const balance = coinsBalance; // always use the store value

  const listData = useMemo(() => {
    if (activeTab === 'TRANSACTIONS') return data?.transactions || [];
    return data?.claimable || [];
  }, [data, activeTab]);

  const transactionCount = data?.transactions?.length ?? 0;
  const rewardCount = data?.claimable?.length ?? 0;

  const stats = useMemo(
    () => [
      {
        id: 'balance',
        label: 'Available',
        value: formatCoins(balance),
        icon: 'Wallet',
      },
      {
        id: 'history',
        label: 'History',
        value: `${transactionCount}`,
        icon: 'History',
      },
      {
        id: 'rewards',
        label: 'Rewards',
        value: `${rewardCount}`,
        icon: 'BadgeDollarSign',
      },
    ],
    [balance, transactionCount, rewardCount],
  );

  const renderHero = () => {
    return (
      // Outer: layout animation for reflow
      <Animated.View layout={LinearTransition.springify()}>
        {/* Inner: enter animation — separate view to avoid transform conflict */}
        <Animated.View
          entering={FadeInDown.duration(500)}
          style={[
            styles.heroCard,
            {
              marginHorizontal: spacing[4],
              marginTop: spacing[3],
              padding: spacing[5],
              borderRadius: radius?.xl ?? 24,
              backgroundColor: colors.card,
              borderColor: withOpacity(colors.border, 0.7),
            },
          ]}
        >
        <View
          style={[
            styles.heroGlow,
            { backgroundColor: withOpacity(colors.primary, 0.14) },
          ]}
        />
        <View
          style={[
            styles.coinBadge,
            {
              backgroundColor: withOpacity('#F5C518', 0.15),
              borderColor: withOpacity('#F5C518', 0.3),
            },
          ]}
        >
          <Icon name="Circle" size={26} color="#F5C518" />
        </View>

        <AppText
          variant="overline"
          secondary
          style={{ textAlign: 'center', marginTop: spacing[2] }}
        >
          TOTAL COIN BALANCE
        </AppText>

        <View style={[styles.balanceRow, { marginTop: spacing[2] }]}>
          <AppText variant="largeTitle" weight="bold">
            {balance}
          </AppText>
          <AppText
            variant="subhead"
            secondary
            style={{ marginLeft: spacing[2], marginTop: 8 }}
          >
            coins
          </AppText>
        </View>

        <AppText
          variant="body"
          secondary
          style={{
            textAlign: 'center',
            marginTop: spacing[2],
            paddingHorizontal: spacing[3],
          }}
        >
          Track rewards, review coin activity, and unlock more benefits through
          challenges and goals.
        </AppText>
        </Animated.View>
      </Animated.View>
    );
  };

  const renderStats = () => {
    return (
      <Animated.View
        entering={FadeInUp.duration(650)}
        style={[
          styles.statsRow,
          {
            paddingHorizontal: spacing[4],
            marginTop: spacing[4],
            gap: spacing[3],
          },
        ]}
      >
        {stats.map(stat => (
          <View
            key={stat.id}
            style={[
              styles.statCard,
              {
                backgroundColor: colors.card,
                borderColor: withOpacity(colors.border, 0.65),
                borderRadius: radius?.lg ?? 18,
                padding: spacing[4],
              },
            ]}
          >
            <View
              style={[
                styles.statIconWrap,
                {
                  backgroundColor: withOpacity(colors.primary, 0.12),
                },
              ]}
            >
              <Icon name={stat.icon as any} size={18} color={colors.primary} />
            </View>

            <AppText
              variant="headline"
              weight="bold"
              style={{ marginTop: spacing[3] }}
            >
              {stat.value}
            </AppText>

            <AppText variant="caption1" secondary style={{ marginTop: 4 }}>
              {stat.label}
            </AppText>
          </View>
        ))}
      </Animated.View>
    );
  };

  const renderTabs = () => {
    return (
      <Animated.View
        entering={FadeInUp.duration(750)}
        style={[
          styles.tabsContainer,
          {
            marginHorizontal: spacing[4],
            marginTop: spacing[4],
            padding: 4,
            borderRadius: 999,
            backgroundColor: withOpacity(colors.border, 0.35),
          },
        ]}
      >
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;

          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tab,
                {
                  borderRadius: 999,
                  backgroundColor: isActive ? colors.card : 'transparent',
                },
                isActive && styles.activeTabShadow,
              ]}
            >
              <View style={styles.tabInner}>
                <Icon
                  name={tab.icon as any}
                  size={16}
                  color={isActive ? colors.primary : colors.foreground}
                />
                <AppText
                  variant="subhead"
                  weight={isActive ? 'semiBold' : 'regular'}
                  secondary={!isActive}
                  style={{ marginLeft: spacing[2] }}
                >
                  {tab.label}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </Animated.View>
    );
  };

  const renderSectionHeader = () => (
    <View
      style={[
        styles.sectionHeader,
        {
          paddingHorizontal: spacing[4],
          marginTop: spacing[5],
          marginBottom: spacing[2],
        },
      ]}
    >
      <View>
        <AppText variant="title3" weight="semiBold">
          {activeTab === 'TRANSACTIONS' ? 'Recent Activity' : 'Claim Rewards'}
        </AppText>
        <AppText variant="caption1" secondary style={{ marginTop: 4 }}>
          {activeTab === 'TRANSACTIONS'
            ? 'Your latest coin earnings and spending history'
            : 'Available rewards you can complete and claim'}
        </AppText>
      </View>
    </View>
  );

  const renderEmpty = () => {
    return (
      <View style={[styles.emptyState, { paddingHorizontal: spacing[6] }]}>
        <View
          style={[
            styles.emptyIconWrap,
            { backgroundColor: withOpacity(colors.primary, 0.1) },
          ]}
        >
          <Icon
            name={activeTab === 'TRANSACTIONS' ? 'Inbox' : 'Gift'}
            size={34}
            color={colors.primary}
          />
        </View>

        <AppText
          variant="title3"
          weight="semiBold"
          style={{ marginTop: spacing[4] }}
        >
          {activeTab === 'TRANSACTIONS'
            ? 'No activity yet'
            : 'No rewards available'}
        </AppText>

        <AppText
          variant="body"
          secondary
          style={{
            textAlign: 'center',
            marginTop: spacing[2],
            lineHeight: 22,
          }}
        >
          {activeTab === 'TRANSACTIONS'
            ? 'Your completed coin activity will appear here once you start earning or spending coins.'
            : 'New challenges and claimable rewards will appear here when they become available.'}
        </AppText>
      </View>
    );
  };

  const renderItem: ListRenderItem<CoinTransaction | ClaimableReward> = ({
    item,
  }) => {
    return activeTab === 'TRANSACTIONS' ? (
      <Animated.View entering={FadeInDown.duration(300)}>
        <TransactionItem item={item as CoinTransaction} />
      </Animated.View>
    ) : (
      <Animated.View entering={FadeInDown.duration(300)}>
        <ClaimableItem item={item as ClaimableReward} />
      </Animated.View>
    );
  };

  if (isLoading) {
    return (
      <Screen padded={false} safeArea={false}>
        <AppView
          style={[
            styles.loaderContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText variant="body" secondary style={{ marginTop: spacing[3] }}>
            Loading coins...
          </AppText>
        </AppView>
      </Screen>
    );
  }

  return (
    <Screen padded={false} safeArea={false}>
      <AppView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <Header title="Coins" showBack backLabel="" />

        <FlatList
          data={listData as (CoinTransaction | ClaimableReward)[]}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: spacing[8],
          }}
          ListHeaderComponent={
            <>
              {renderHero()}
              {renderStats()}
              {renderTabs()}
              {renderSectionHeader()}
            </>
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
          ListEmptyComponent={renderEmpty}
          contentInsetAdjustmentBehavior="never"
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      </AppView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  heroCard: {
    overflow: 'hidden',
    borderWidth: 1,
    alignItems: 'center',
    position: 'relative',
  },

  heroGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 999,
    top: -40,
    alignSelf: 'center',
  },

  coinBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },

  balanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  statsRow: {
    flexDirection: 'row',
  },

  statCard: {
    flex: 1,
    borderWidth: 1,
  },

  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },

  tabsContainer: {
    flexDirection: 'row',
  },

  tab: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },

  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  activeTabShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 70,
  },

  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CoinScreen;
