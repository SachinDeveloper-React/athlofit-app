import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  Pressable,
  RefreshControl,
  View,
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

import { useCoinTransactions, useClaimReward } from '../hooks/useGamification';
import { CoinTransaction, ClaimableReward } from '../types/gamification.type';
import { withOpacity } from '../../../utils/withOpacity';
import TransactionItem from '../components/coins/TransactionItem';
import ClaimableItem from '../components/coins/ClaimableItem';
import { useGamificationStore } from '../store/gamificationStore';
import { formatCoins } from '../../../config/appConfig';
import { makeStyles } from '../../../hooks/makeStyles';

type TabKey = 'TRANSACTIONS' | 'REWARDS';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'TRANSACTIONS', label: 'History',    icon: 'Clock3' },
  { key: 'REWARDS',      label: 'Earn Coins', icon: 'Gift'   },
];

const PAGE_SIZE = 20;

// ─── Styles ───────────────────────────────────────────────────────────────────

const useStyles = makeStyles(({ colors, spacing, radius, shadow }) => ({
  container:       { flex: 1 },
  loaderContainer: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const },
  heroCard:        { overflow: 'hidden' as const, borderWidth: 1, alignItems: 'center' as const, position: 'relative' as const },
  heroGlow:        { position: 'absolute' as const, width: 180, height: 180, borderRadius: radius.full, top: -40, alignSelf: 'center' as const },
  coinBadge:       { width: 58, height: 58, borderRadius: 29, justifyContent: 'center' as const, alignItems: 'center' as const, borderWidth: 1 },
  balanceRow:      { flexDirection: 'row' as const, alignItems: 'flex-end' as const, justifyContent: 'center' as const },
  statsRow:        { flexDirection: 'row' as const },
  statCard:        { flex: 1, borderWidth: 1 },
  statIconWrap:    { width: 34, height: 34, borderRadius: 17, justifyContent: 'center' as const, alignItems: 'center' as const },
  tabsContainer:   { flexDirection: 'row' as const },
  tab:             { flex: 1, height: 48, justifyContent: 'center' as const, alignItems: 'center' as const },
  tabInner:        { flexDirection: 'row' as const, alignItems: 'center' as const },
  activeTabShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  sectionHeader:   { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  emptyState:      { alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: 70 },
  emptyIconWrap:   { width: 72, height: 72, borderRadius: 36, justifyContent: 'center' as const, alignItems: 'center' as const },
  footerLoader:    { paddingVertical: 20, alignItems: 'center' as const },
}));

// ─── Footer spinner shown while loading the next page ────────────────────────

const ListFooter = ({ isFetchingNextPage }: { isFetchingNextPage: boolean }) => {
  const { colors, spacing } = useTheme();
  if (!isFetchingNextPage) return null;
  return (
    <View style={{ paddingVertical: spacing[5], alignItems: 'center' }}>
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

const CoinScreen = () => {
  const { colors, spacing, radius } = useTheme();
  const styles = useStyles();

  const [activeTab, setActiveTab] = useState<TabKey>('TRANSACTIONS');

  const coinsBalance    = useGamificationStore(s => s.coinsBalance);
  const setCoinsBalance = useGamificationStore(s => s.setCoinsBalance);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useCoinTransactions();

  // Keep Zustand balance in sync with server balance
  useEffect(() => {
    const serverBalance = data?.balance;
    if (serverBalance != null && serverBalance !== coinsBalance) {
      setCoinsBalance(serverBalance);
    }
  }, [data?.balance]);

  const balance          = coinsBalance;
  const transactions     = data?.transactions ?? [];
  const claimable        = data?.claimable    ?? [];
  const totalTransactions = data?.totalTransactions ?? 0;

  // ── Load more when user reaches the end of the transactions list ──────────
  const handleEndReached = useCallback(() => {
    if (activeTab === 'TRANSACTIONS' && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [activeTab, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── Stats cards ───────────────────────────────────────────────────────────
  const stats = useMemo(() => [
    { id: 'balance', label: 'Available',  value: formatCoins(balance),          icon: 'Wallet'          },
    { id: 'history', label: 'History',    value: `${totalTransactions}`,         icon: 'History'         },
    { id: 'rewards', label: 'Rewards',    value: `${claimable.length}`,          icon: 'BadgeDollarSign' },
  ], [balance, totalTransactions, claimable.length]);

  // ── List data — switch between tabs ──────────────────────────────────────
  const listData: (CoinTransaction | ClaimableReward)[] = useMemo(
    () => activeTab === 'TRANSACTIONS' ? transactions : claimable,
    [activeTab, transactions, claimable],
  );

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderHero = useCallback(() => (
    <Animated.View layout={LinearTransition.springify()}>
      <Animated.View
        entering={FadeInDown.duration(500)}
        style={[
          styles.heroCard,
          {
            marginHorizontal: spacing[4],
            marginTop: spacing[3],
            padding: spacing[5],
            borderRadius: radius?.xl ?? 16,
            backgroundColor: colors.card,
            borderColor: withOpacity(colors.border, 0.7),
          },
        ]}
      >
        <View style={[styles.heroGlow, { backgroundColor: withOpacity(colors.primary, 0.14) }]} />
        <View style={[styles.coinBadge, { backgroundColor: withOpacity('#F5C518', 0.15), borderColor: withOpacity('#F5C518', 0.3) }]}>
          <Icon name="Circle" size={26} color="#F5C518" />
        </View>
        <AppText variant="overline" secondary style={{ textAlign: 'center', marginTop: spacing[2] }}>
          TOTAL COIN BALANCE
        </AppText>
        <View style={[styles.balanceRow, { marginTop: spacing[2] }]}>
          <AppText variant="largeTitle" weight="bold">{balance}</AppText>
          <AppText variant="subhead" secondary style={{ marginLeft: spacing[2], marginTop: 8 }}>coins</AppText>
        </View>
        <AppText variant="body" secondary style={{ textAlign: 'center', marginTop: spacing[2], paddingHorizontal: spacing[3] }}>
          Track rewards, review coin activity, and unlock more benefits through challenges and goals.
        </AppText>
      </Animated.View>
    </Animated.View>
  ), [balance, colors, spacing, radius]);

  const renderStats = useCallback(() => (
    <Animated.View
      entering={FadeInUp.duration(650)}
      style={[styles.statsRow, { paddingHorizontal: spacing[4], marginTop: spacing[4], gap: spacing[3] }]}
    >
      {stats.map(stat => (
        <View
          key={stat.id}
          style={[
            styles.statCard,
            {
              backgroundColor: colors.card,
              borderColor: withOpacity(colors.border, 0.65),
              borderRadius: radius?.lg ?? 12,
              padding: spacing[4],
            },
          ]}
        >
          <View style={[styles.statIconWrap, { backgroundColor: withOpacity(colors.primary, 0.12) }]}>
            <Icon name={stat.icon as any} size={18} color={colors.primary} />
          </View>
          <AppText variant="headline" weight="bold" style={{ marginTop: spacing[3] }}>{stat.value}</AppText>
          <AppText variant="caption1" secondary style={{ marginTop: 4 }}>{stat.label}</AppText>
        </View>
      ))}
    </Animated.View>
  ), [stats, colors, spacing, radius]);

  const renderTabs = useCallback(() => (
    <Animated.View
      entering={FadeInUp.duration(750)}
      style={[
        styles.tabsContainer,
        {
          marginHorizontal: spacing[4],
          marginTop: spacing[4],
          padding: 4,
          borderRadius: radius.full,
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
              { borderRadius: radius.full, backgroundColor: isActive ? colors.card : 'transparent' },
              isActive && styles.activeTabShadow,
            ]}
          >
            <View style={styles.tabInner}>
              <Icon name={tab.icon as any} size={16} color={isActive ? colors.primary : colors.foreground} />
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
  ), [activeTab, colors, spacing, radius]);

  const renderSectionHeader = useCallback(() => (
    <View style={[styles.sectionHeader, { paddingHorizontal: spacing[4], marginTop: spacing[5], marginBottom: spacing[2] }]}>
      <View>
        <AppText variant="title3" weight="semiBold">
          {activeTab === 'TRANSACTIONS' ? 'Recent Activity' : 'Claim Rewards'}
        </AppText>
        <AppText variant="caption1" secondary style={{ marginTop: 4 }}>
          {activeTab === 'TRANSACTIONS'
            ? `${totalTransactions} total transaction${totalTransactions !== 1 ? 's' : ''}`
            : 'Available rewards you can complete and claim'}
        </AppText>
      </View>
    </View>
  ), [activeTab, totalTransactions, spacing]);

  const renderEmpty = useCallback(() => (
    <View style={[styles.emptyState, { paddingHorizontal: spacing[6] }]}>
      <View style={[styles.emptyIconWrap, { backgroundColor: withOpacity(colors.primary, 0.1) }]}>
        <Icon name={activeTab === 'TRANSACTIONS' ? 'Inbox' : 'Gift'} size={34} color={colors.primary} />
      </View>
      <AppText variant="title3" weight="semiBold" style={{ marginTop: spacing[4] }}>
        {activeTab === 'TRANSACTIONS' ? 'No activity yet' : 'No rewards available'}
      </AppText>
      <AppText variant="body" secondary style={{ textAlign: 'center', marginTop: spacing[2], lineHeight: 22 }}>
        {activeTab === 'TRANSACTIONS'
          ? 'Your completed coin activity will appear here once you start earning or spending coins.'
          : 'New challenges and claimable rewards will appear here when they become available.'}
      </AppText>
    </View>
  ), [activeTab, colors, spacing]);

  const renderItem: ListRenderItem<CoinTransaction | ClaimableReward> = useCallback(({ item }) => (
    activeTab === 'TRANSACTIONS'
      ? <TransactionItem item={item as CoinTransaction} />
      : <ClaimableItem   item={item as ClaimableReward} />
  ), [activeTab]);

  const keyExtractor = useCallback((item: CoinTransaction | ClaimableReward) => item.id, []);

  // ── Initial full-screen loader ────────────────────────────────────────────
  if (isLoading) {
    return (
      <Screen padded={false} safeArea={false}>
        <AppView style={[styles.loaderContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText variant="body" secondary style={{ marginTop: spacing[3] }}>Loading coins...</AppText>
        </AppView>
      </Screen>
    );
  }

  return (
    <Screen padded={false} safeArea={false}>
      <AppView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title="Coins" showBack backLabel="" />

        <FlatList
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing[8] }}
          // ── Pagination ──────────────────────────────────────────────────
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.35}
          ListFooterComponent={<ListFooter isFetchingNextPage={isFetchingNextPage} />}
          // ── Pull-to-refresh ─────────────────────────────────────────────
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          // ── Header sections ─────────────────────────────────────────────
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
          initialNumToRender={PAGE_SIZE}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      </AppView>
    </Screen>
  );
};

export default CoinScreen;
