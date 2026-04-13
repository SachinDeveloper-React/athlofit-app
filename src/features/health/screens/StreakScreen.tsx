// src/features/health/screens/StreakScreen.tsx
import React from 'react';
import { StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { AppText, AppView, Header, Screen } from '../../../components';
import { useStreakScreen } from '../hooks/useStreakScreen';
import { StreakRing } from '../components/streaks/StreakRing';
import { BadgeItem } from '../components/streaks/BadgeItem';

const StreakScreen: React.FC = () => {
  const {
    colors,
    streakDays,
    bestStreakDays,
    nextTarget,
    nextBadgeAt,
    badges,
    isRefetching,
    refetch,
  } = useStreakScreen();

  const refreshControl = (
    <RefreshControl
      refreshing={isRefetching}
      onRefresh={refetch}
      tintColor={colors.primary}
    />
  );

  // Find the next locked badge for the "upcoming" callout
  const nextBadge = badges.find(b => !b.unlocked);
  const unlockedCount = badges.filter(b => b.unlocked).length;

  return (
    <Screen
      scroll
      safeArea={false}
      refreshControl={refreshControl}
      header={<Header title="Streaks & Badges" showBack backLabel="" />}
    >
      <AppView style={styles.container}>
        {/* ── Hero ring ── */}
        <AppView
          style={[
            styles.heroCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <AppView center style={{ marginBottom: 16 }}>
            <StreakRing
              current={streakDays}
              max={nextTarget}
              color={colors.primary}
            />
          </AppView>

          <AppText
            variant="title2"
            weight="bold"
            align="center"
            style={{ marginBottom: 4 }}
          >
            {streakDays === 0
              ? 'Start your streak today!'
              : `${streakDays}-Day Streak 🔥`}
          </AppText>

          {/* Next milestone callout */}
          {nextBadge ? (
            <AppView
              style={[
                styles.nextMilestonePill,
                { backgroundColor: (nextBadge.color ?? colors.primary) + '18' },
              ]}
            >
              <AppText
                variant="caption1"
                weight="semiBold"
                style={{
                  color: nextBadge.color ?? colors.primary,
                  textAlign: 'center',
                }}
              >
                {nextBadge.emoji}{'  '}
                {nextBadge.threshold - streakDays} day
                {nextBadge.threshold - streakDays !== 1 ? 's' : ''} until{' '}
                {nextBadge.title}
              </AppText>
            </AppView>
          ) : (
            <AppText
              variant="callout"
              align="center"
              style={{ opacity: 0.6, marginBottom: 8 }}
            >
              All badges earned! You're elite 👑
            </AppText>
          )}

          {/* Stats row */}
          <AppView row style={[styles.statsRow, { marginTop: 16 }]}>
            <AppView
              style={[
                styles.statBox,
                { backgroundColor: colors.primary + '12' },
              ]}
            >
              <AppText
                variant="title2"
                weight="bold"
                style={{ color: colors.primary }}
              >
                {streakDays}
              </AppText>
              <AppText variant="caption1" style={{ opacity: 0.6 }}>
                Current
              </AppText>
            </AppView>
            <AppView
              style={[styles.statDivider, { backgroundColor: colors.border }]}
            />
            <AppView style={[styles.statBox, { backgroundColor: colors.card }]}>
              <AppText variant="title2" weight="bold">
                {bestStreakDays}
              </AppText>
              <AppText variant="caption1" style={{ opacity: 0.6 }}>
                Best Ever
              </AppText>
            </AppView>
            <AppView
              style={[styles.statDivider, { backgroundColor: colors.border }]}
            />
            <AppView style={[styles.statBox, { backgroundColor: colors.card }]}>
              <AppText
                variant="title2"
                weight="bold"
                style={{ color: colors.primary }}
              >
                {unlockedCount}/{badges.length}
              </AppText>
              <AppText variant="caption1" style={{ opacity: 0.6 }}>
                Badges
              </AppText>
            </AppView>
          </AppView>
        </AppView>

        {/* ── How streaks work ── */}
        <AppView
          style={[
            styles.infoCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <AppText
            variant="footnote"
            weight="semiBold"
            style={{ opacity: 0.5, marginBottom: 8 }}
          >
            HOW STREAKS WORK
          </AppText>
          <AppText variant="callout" style={{ opacity: 0.75, lineHeight: 22 }}>
            Meet your daily step goal each day to extend your streak. Missing a
            single day resets the counter. Keep active and unlock all badges!
          </AppText>
        </AppView>

        {/* ── Badges horizontal scroll ── */}
        <AppView style={styles.badgesHeader}>
          <AppText
            variant="footnote"
            weight="semiBold"
            style={{ color: colors.foreground + '60', letterSpacing: 0.5 }}
          >
            MILESTONE BADGES
          </AppText>
          <AppText
            variant="caption2"
            style={{ color: colors.foreground + '40' }}
          >
            {unlockedCount} of {badges.length} earned
          </AppText>
        </AppView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.badgesScrollContent}
          decelerationRate="fast"
          snapToInterval={132}
          snapToAlignment="start"
        >
          {badges.map((badge, index) => (
            <BadgeItem
              key={badge.key}
              badge={badge}
              streakDays={streakDays}
              index={index}
              colors={colors}
            />
          ))}
        </ScrollView>

        {/* Bottom spacer */}
        <AppView style={{ height: 40 }} />
      </AppView>
    </Screen>
  );
};

export default StreakScreen;

const styles = StyleSheet.create({
  container: { paddingTop: 12 },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  nextMilestonePill: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 4,
  },
  statsRow: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 2,
  },
  statDivider: { width: 1, marginVertical: 8 },
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  badgesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgesScrollContent: {
    gap: 12,
    paddingRight: 24,
  },
});
