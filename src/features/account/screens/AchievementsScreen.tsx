import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Screen, AppText, AppView, Header, Icon } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { AchievementItem, useAchievements } from '../hooks/useAchievements';
import { withOpacity } from '../../../utils/withOpacity';
import {
  Award,
  Star,
  Zap,
  ShoppingBag,
  Droplets,
  Trophy,
  Footprints,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

const ICON_MAP: Record<string, any> = {
  Award: Award,
  Star: Star,
  Zap: Zap,
  ShoppingBag: ShoppingBag,
  Droplets: Droplets,
  Trophy: Trophy,
  Footprints: Footprints,
};

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
      claimAchievement(item.id, {
        onSuccess: () => {
          Alert.alert(
            'Achievement Unlocked!',
            `You earned ${item.reward} coins!`,
          );
        },
        onError: (err: any) => {
          Alert.alert('Error', err?.message || 'Failed to claim achievement.');
        },
      });
    },
    [claimAchievement, isClaiming],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: AchievementItem; index: number }) => {
      const LucideIcon = ICON_MAP[item.icon] || Award;
      const progressPercent = Math.min(
        100,
        Math.round((item.progress / item.targetValue) * 100),
      );

      return (
        <Animated.View entering={FadeInDown.delay(index * 100).springify()}>
          <AppView
            style={[
              styles.card,
              { backgroundColor: colors.background },
              item.isClaimed && { borderColor: colors.gold, borderWidth: 1 },
            ]}
          >
            <AppView style={styles.cardHeader}>
              <AppView
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: item.isClaimed
                      ? withOpacity(colors.gold, 0.15)
                      : withOpacity(colors.primary, 0.1),
                  },
                ]}
              >
                <LucideIcon
                  color={
                    item.isClaimed
                      ? colors.gold
                      : item.isClaimable
                      ? colors.success
                      : colors.primary
                  }
                  size={24}
                />
              </AppView>

              <AppView style={styles.infoContainer}>
                <AppText style={styles.title} weight="bold">
                  {item.title}
                </AppText>
                <AppText
                  style={[styles.desc, { color: colors.secondaryForeground }]}
                  variant="caption1"
                >
                  {item.description}
                </AppText>
              </AppView>

              <AppView style={styles.rewardContainer}>
                <Icon
                  name="Coins"
                  size={16}
                  color={colors.gold}
                  style={{ marginRight: 4 }}
                />
                <AppText style={{ color: colors.gold }} weight="bold">
                  +{item.reward}
                </AppText>
              </AppView>
            </AppView>

            {!item.isClaimed && (
              <AppView style={styles.progressContainer}>
                <AppView
                  style={[
                    styles.progressTrack,
                    { backgroundColor: colors.border },
                  ]}
                >
                  <AppView
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: item.isClaimable
                          ? colors.success
                          : colors.primary,
                        width: `${progressPercent}%`,
                      },
                    ]}
                  />
                </AppView>
                <AppText
                  style={[
                    styles.progressText,
                    { color: colors.secondaryForeground },
                  ]}
                  variant="caption1"
                >
                  {item.progress} / {item.targetValue}
                </AppText>
              </AppView>
            )}

            {item.isClaimable && !item.isClaimed && (
              <TouchableOpacity
                style={[
                  styles.claimButton,
                  { backgroundColor: colors.success },
                ]}
                onPress={() => handleClaim(item)}
                disabled={isClaiming}
              >
                <AppText style={styles.claimText} weight="bold">
                  CLAIM REWARD
                </AppText>
              </TouchableOpacity>
            )}

            {item.isClaimed && (
              <AppView
                style={[
                  styles.claimedBadge,
                  { backgroundColor: withOpacity(colors.gold, 0.1) },
                ]}
              >
                <Icon
                  name="CheckCircle"
                  size={14}
                  color={colors.gold}
                  style={{ marginRight: 6 }}
                />
                <AppText
                  style={{ color: colors.gold }}
                  variant="caption1"
                  weight="bold"
                >
                  CLAIMED
                </AppText>
              </AppView>
            )}
          </AppView>
        </Animated.View>
      );
    },
    [colors, handleClaim, isClaiming],
  );

  const sortedAchievements = useMemo(() => {
    // Sort: Claimable first, then in progress, then claimed
    return [...achievements].sort((a, b) => {
      if (a.isClaimable && !a.isClaimed && !(b.isClaimable && !b.isClaimed))
        return -1;
      if (!(a.isClaimable && !a.isClaimed) && b.isClaimable && !b.isClaimed)
        return 1;
      if (a.isClaimed && !b.isClaimed) return 1;
      if (!a.isClaimed && b.isClaimed) return -1;
      return b.progress / b.targetValue - a.progress / a.targetValue;
    });
  }, [achievements]);

  return (
    <Screen safeArea={false}>
      <Header title="Achievements" showBack bordered backLabel="" />
      <FlatList
        data={sortedAchievements}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <AppView style={styles.emptyContainer}>
              <Icon name="Award" size={48} color={colors.mutedForeground} />
              <AppText
                style={[styles.emptyText, { color: colors.mutedForeground }]}
                align="center"
              >
                No achievements available yet.
              </AppText>
            </AppView>
          ) : null
        }
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    marginBottom: 4,
  },
  desc: {
    lineHeight: 18,
  },
  rewardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    marginTop: 8,
    textAlign: 'right',
  },
  claimButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  claimText: {
    color: '#fff',
    fontSize: 14,
    letterSpacing: 1,
  },
  claimedBadge: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 16,
  },
});

export default AchievementsScreen;
