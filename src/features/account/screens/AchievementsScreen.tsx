import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Screen, AppText, Header, Icon } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { AchievementItem, useAchievements } from '../hooks/useAchievements';
import { withOpacity } from '../../../utils/withOpacity';
import type { LucideName } from '../../../components/Icon';

// ─── Achievement Card ─────────────────────────────────────────────────────────

const AchievementCard = ({
  item,
  index,
  onClaim,
  isClaiming,
}: {
  item: AchievementItem;
  index: number;
  onClaim: (item: AchievementItem) => void;
  isClaiming: boolean;
}) => {
  const { colors } = useTheme();
  const progressPercent = Math.min(100, Math.round((item.progress / item.targetValue) * 100));

  const iconColor = item.isClaimed
    ? '#F59E0B'
    : item.isClaimable
    ? '#10B981'
    : colors.primary;

  const iconBg = item.isClaimed
    ? withOpacity('#F59E0B', 0.12)
    : item.isClaimable
    ? withOpacity('#10B981', 0.12)
    : withOpacity(colors.primary, 0.1);

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(350)}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: item.isClaimed
              ? withOpacity('#F59E0B', 0.3)
              : withOpacity(colors.border, 0.6),
          },
        ]}
      >
        {/* Icon + Info Row */}
        <View style={styles.row}>
          <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
            <Icon name={(item.icon || 'Award') as LucideName} size={22} color={iconColor} />
          </View>

          <View style={styles.info}>
            <AppText variant="subhead" weight="semiBold" numberOfLines={1}>
              {item.title}
            </AppText>
            <AppText variant="caption1" secondary numberOfLines={2} style={{ marginTop: 3, lineHeight: 18 }}>
              {item.description}
            </AppText>
          </View>

          {/* Reward Badge */}
          <View style={[styles.rewardBadge, { backgroundColor: withOpacity('#F59E0B', 0.1) }]}>
            <Icon name="Coins" size={13} color="#D97706" />
            <AppText variant="caption2" weight="bold" color="#B45309" style={{ marginLeft: 4 }}>
              +{item.reward}
            </AppText>
          </View>
        </View>

        {/* Progress Section (only if not claimed) */}
        {!item.isClaimed && (
          <View style={styles.progressSection}>
            <View style={[styles.progressTrack, { backgroundColor: withOpacity(colors.border, 0.5) }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progressPercent}%`,
                    backgroundColor: item.isClaimable ? '#10B981' : colors.primary,
                  },
                ]}
              />
            </View>
            <View style={styles.progressLabelRow}>
              <AppText variant="caption2" secondary>
                {item.progress.toLocaleString()} / {item.targetValue.toLocaleString()}
              </AppText>
              <AppText variant="caption2" weight="semiBold" color={item.isClaimable ? '#10B981' : colors.primary}>
                {progressPercent}%
              </AppText>
            </View>
          </View>
        )}

        {/* Claim Button */}
        {item.isClaimable && !item.isClaimed && (
          <Pressable
            onPress={() => onClaim(item)}
            disabled={isClaiming}
            style={[styles.claimBtn, { backgroundColor: '#10B981', opacity: isClaiming ? 0.6 : 1 }]}
          >
            {isClaiming ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="Gift" size={15} color="#fff" />
                <AppText variant="caption1" weight="bold" color="#fff" style={{ marginLeft: 6 }}>
                  Claim Reward
                </AppText>
              </>
            )}
          </Pressable>
        )}

        {/* Claimed Badge */}
        {item.isClaimed && (
          <View style={[styles.claimedRow, { backgroundColor: withOpacity('#F59E0B', 0.08) }]}>
            <Icon name="CheckCircle2" size={14} color="#F59E0B" />
            <AppText variant="caption2" weight="bold" color="#D97706" style={{ marginLeft: 5 }}>
              Achieved
            </AppText>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const AchievementsScreen = () => {
  const { colors } = useTheme();
  const {
    achievements,
    isLoading,
    isRefetching,
    refetch,
    claimAchievement,
    isClaiming,
  } = useAchievements();

  const handleClaim = useCallback(
    (item: AchievementItem) => {
      if (isClaiming) return;
      claimAchievement(item.id);
    },
    [claimAchievement, isClaiming],
  );

  const sortedAchievements = useMemo(() => {
    return [...achievements].sort((a, b) => {
      // Claimable first
      if (a.isClaimable && !a.isClaimed && !(b.isClaimable && !b.isClaimed)) return -1;
      if (!(a.isClaimable && !a.isClaimed) && b.isClaimable && !b.isClaimed) return 1;
      // Claimed last
      if (a.isClaimed && !b.isClaimed) return 1;
      if (!a.isClaimed && b.isClaimed) return -1;
      // Higher progress first
      return b.progress / b.targetValue - a.progress / a.targetValue;
    });
  }, [achievements]);

  // Stats summary
  const stats = useMemo(() => {
    const total = achievements.length;
    const claimed = achievements.filter(a => a.isClaimed).length;
    const claimable = achievements.filter(a => a.isClaimable && !a.isClaimed).length;
    return { total, claimed, claimable };
  }, [achievements]);

  const renderHeader = useCallback(() => (
    <Animated.View entering={FadeInUp.duration(400)}>
      {/* Stats Row */}
      <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: withOpacity(colors.border, 0.6) }]}>
        {[
          { label: 'Total',     value: stats.total,     icon: 'Trophy' as LucideName,      color: colors.primary },
          { label: 'Claimed',   value: stats.claimed,   icon: 'CheckCircle2' as LucideName, color: '#F59E0B' },
          { label: 'Claimable', value: stats.claimable, icon: 'Gift' as LucideName,         color: '#10B981' },
        ].map((s, i) => (
          <View key={s.label} style={[styles.statItem, i < 2 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: withOpacity(colors.border, 0.5) }]}>
            <View style={[styles.statIcon, { backgroundColor: withOpacity(s.color, 0.1) }]}>
              <Icon name={s.icon} size={16} color={s.color} />
            </View>
            <AppText variant="headline" weight="bold" style={{ marginTop: 6 }}>{s.value}</AppText>
            <AppText variant="caption2" secondary style={{ marginTop: 2 }}>{s.label}</AppText>
          </View>
        ))}
      </View>

      {/* Section Title */}
      <View style={styles.sectionTitle}>
        <AppText variant="subhead" weight="semiBold">All Achievements</AppText>
        <AppText variant="caption1" secondary>{stats.claimed}/{stats.total} completed</AppText>
      </View>
    </Animated.View>
  ), [colors, stats]);

  if (isLoading) {
    return (
      <Screen safeArea={false} header={<Header title="Achievements" showBack bordered backLabel="" />}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText variant="body" secondary style={{ marginTop: 12 }}>Loading achievements...</AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen safeArea={false} header={<Header title="Achievements" showBack bordered backLabel="" />} padded={false}>
      <FlatList
        data={sortedAchievements}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <AchievementCard
            item={item}
            index={index}
            onClaim={handleClaim}
            isClaiming={isClaiming}
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <Animated.View entering={FadeInUp.duration(350)} style={styles.emptyWrap}>
            <View style={[styles.emptyIcon, { backgroundColor: withOpacity(colors.primary, 0.1) }]}>
              <Icon name="Award" size={40} color={colors.primary} />
            </View>
            <AppText variant="title3" weight="bold" style={{ marginTop: 16 }}>No achievements yet</AppText>
            <AppText variant="body" secondary align="center" style={{ marginTop: 8, paddingHorizontal: 40, lineHeight: 22 }}>
              Complete goals and challenges to unlock achievements and earn coins.
            </AppText>
          </Animated.View>
        }
      />
    </Screen>
  );
};

export default AchievementsScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
    paddingBottom: 60,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section
  sectionTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },

  // Card
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },

  // Progress
  progressSection: {
    marginTop: 14,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },

  // Claim Button
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 11,
    borderRadius: 12,
  },

  // Claimed
  claimedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },

  // Empty
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
