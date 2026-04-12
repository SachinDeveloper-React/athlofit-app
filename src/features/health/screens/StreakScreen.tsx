// src/features/health/screens/StreakScreen.tsx
import React, { useCallback } from 'react';
import { StyleSheet, RefreshControl, View } from 'react-native';
import { AppText, AppView, Header, Screen } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { useStreaks } from '../hooks/useStreaks';
import type { TrackerBadge } from '../types/gamification.type';

// ─── Badge metadata ───────────────────────────────────────────────────────────
const BADGE_THRESHOLDS = { starter: 1, consistent: 7, finisher: 15, elite: 30 };
const BADGE_EMOJI: Record<string, string> = {
  starter: '🥉', consistent: '🥈', finisher: '🥇', elite: '👑',
};
const BADGE_COLORS: Record<string, string> = {
  starter: '#cd7f32', consistent: '#aaaaaa', finisher: '#ffd700', elite: '#a855f7',
};

// ─── Circular streak ring ─────────────────────────────────────────────────────
const StreakRing: React.FC<{
  current: number;
  max: number;
  size?: number;
  color: string;
}> = ({ current, max, size = 140, color }) => {
  const pct = max > 0 ? Math.min(current / max, 1) : 0;
  const strokeW = 12;
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Background track (pure View circle) */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeW,
          borderColor: color + '22',
        }}
      />
      {/* Filled arc overlay — approximated with border clipping */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeW,
          borderTopColor: pct >= 0.25 ? color : 'transparent',
          borderRightColor: pct >= 0.5 ? color : 'transparent',
          borderBottomColor: pct >= 0.75 ? color : 'transparent',
          borderLeftColor: pct >= 1 ? color : 'transparent',
          transform: [{ rotate: '-90deg' }],
        }}
      />
      <AppText variant="largeTitle" weight="bold" style={{ color, fontSize: 36 }}>
        {current}
      </AppText>
      <AppText variant="caption1" style={{ color: color + 'cc', marginTop: -4 }}>
        DAYS
      </AppText>
    </View>
  );
};

// ─── Badge card ───────────────────────────────────────────────────────────────
const BadgeCard: React.FC<{ badge: TrackerBadge; colors: any }> = ({ badge, colors }) => {
  const threshold = BADGE_THRESHOLDS[badge.key] ?? 1;
  const emoji = BADGE_EMOJI[badge.key] ?? '🏅';
  const badgeColor = BADGE_COLORS[badge.key] ?? colors.primary;

  return (
    <AppView
      style={[
        styles.badgeCard,
        {
          backgroundColor: badge.unlocked
            ? badgeColor + '18'
            : colors.card,
          borderColor: badge.unlocked ? badgeColor : colors.border,
        },
      ]}
    >
      <AppText style={{ fontSize: 32, marginBottom: 4 }}>{emoji}</AppText>
      <AppText
        variant="footnote"
        weight="semibold"
        style={{ color: badge.unlocked ? badgeColor : colors.foreground, textAlign: 'center' }}
      >
        {badge.title}
      </AppText>
      <AppText
        variant="caption2"
        style={{ color: colors.foreground + '60', marginTop: 2, textAlign: 'center' }}
      >
        {badge.rule}
      </AppText>
      {!badge.unlocked && (
        <AppText
          variant="caption2"
          style={{
            marginTop: 6,
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 6,
            backgroundColor: colors.border,
            color: colors.foreground + '70',
            overflow: 'hidden',
          }}
        >
          🔒 {threshold}d
        </AppText>
      )}
      {badge.unlocked && (
        <AppText
          variant="caption2"
          style={{
            marginTop: 6,
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 6,
            backgroundColor: badgeColor + '30',
            color: badgeColor,
            overflow: 'hidden',
          }}
        >
          ✓ EARNED
        </AppText>
      )}
    </AppView>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────
const StreakScreen: React.FC = () => {
  const { colors } = useTheme();
  const { streakDays, bestStreakDays, nextBadgeAt, badges, isLoading, isRefetching, refetch } = useStreaks();

  const nextTarget = nextBadgeAt ?? (badges.every(b => b.unlocked) ? 30 : 1);

  const refreshControl = (
    <RefreshControl
      refreshing={isRefetching}
      onRefresh={refetch}
      tintColor={colors.primary}
    />
  );

  return (
    <Screen
      scroll
      safeArea={false}
      refreshControl={refreshControl}
      header={<Header title="Streaks & Badges" showBack backLabel="" />}
    >
      <AppView style={styles.container}>

        {/* ── Hero ring ── */}
        <AppView style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <AppView center style={{ marginBottom: 16 }}>
            <StreakRing
              current={streakDays}
              max={nextTarget}
              color={colors.primary}
            />
          </AppView>

          <AppText variant="title2" weight="bold" align="center" style={{ marginBottom: 4 }}>
            {streakDays === 0
              ? 'Start your streak today!'
              : `${streakDays}-Day Streak 🔥`}
          </AppText>
          <AppText variant="callout" align="center" style={{ opacity: 0.6, marginBottom: 16 }}>
            {nextBadgeAt
              ? `${nextTarget - streakDays} more day${nextTarget - streakDays !== 1 ? 's' : ''} to next badge`
              : 'All badges earned! You\'re elite 👑'}
          </AppText>

          {/* Stats row */}
          <AppView row style={styles.statsRow}>
            <AppView style={[styles.statBox, { backgroundColor: colors.primary + '12' }]}>
              <AppText variant="title2" weight="bold" style={{ color: colors.primary }}>
                {streakDays}
              </AppText>
              <AppText variant="caption1" style={{ opacity: 0.6 }}>Current</AppText>
            </AppView>
            <AppView style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <AppView style={[styles.statBox, { backgroundColor: colors.card }]}>
              <AppText variant="title2" weight="bold">
                {bestStreakDays}
              </AppText>
              <AppText variant="caption1" style={{ opacity: 0.6 }}>Best Ever</AppText>
            </AppView>
            <AppView style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <AppView style={[styles.statBox, { backgroundColor: colors.card }]}>
              <AppText variant="title2" weight="bold" style={{ color: colors.primary }}>
                {badges.filter(b => b.unlocked).length}/{badges.length}
              </AppText>
              <AppText variant="caption1" style={{ opacity: 0.6 }}>Badges</AppText>
            </AppView>
          </AppView>
        </AppView>

        {/* ── How streaks work ── */}
        <AppView style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <AppText variant="footnote" weight="semibold" style={{ opacity: 0.5, marginBottom: 8 }}>
            HOW STREAKS WORK
          </AppText>
          <AppText variant="callout" style={{ opacity: 0.75, lineHeight: 22 }}>
            Meet your daily step goal each day to extend your streak. Missing a single day resets the counter. Keep active and unlock all 4 badges!
          </AppText>
        </AppView>

        {/* ── Badges grid ── */}
        <AppText variant="footnote" weight="semibold" style={[styles.sectionTitle, { color: colors.foreground + '60' }]}>
          MILESTONE BADGES
        </AppText>
        <AppView style={styles.badgesGrid}>
          {badges.map(badge => (
            <BadgeCard key={badge.key} badge={badge} colors={colors} />
          ))}
        </AppView>

        {/* Bottom spacer */}
        <AppView style={{ height: 32 }} />
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
  sectionTitle: {
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeCard: {
    width: '47%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 2,
  },
});
