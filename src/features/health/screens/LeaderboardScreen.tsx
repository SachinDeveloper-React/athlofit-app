// src/features/health/screens/LeaderboardScreen.tsx
import React, { useCallback } from 'react';
import {
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppText, AppView, Header, Screen } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { useLeaderboard } from '../hooks/useLeaderboard';
import type { LeaderboardEntry } from '../types/leaderboard.types';
import { formatCoins } from '../../../config/appConfig';

// ─── Podium constants ─────────────────────────────────────────────────────────
const MEDAL_COLOR = ['#FFD700', '#C0C0C0', '#CD7F32'];
const MEDAL_EMOJI = ['🥇', '🥈', '🥉'];
const PODIUM_HEIGHT = [110, 80, 60];

// ─── Avatar placeholder ───────────────────────────────────────────────────────
const Avatar: React.FC<{ name: string; size?: number; color?: string }> = ({
  name,
  size = 48,
  color = '#6366f1',
}) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: color + '30',
      borderWidth: 2,
      borderColor: color,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <AppText weight="bold" style={{ color, fontSize: size * 0.36 }}>
      {name?.charAt(0)?.toUpperCase() ?? '?'}
    </AppText>
  </View>
);

// ─── Top-3 podium ─────────────────────────────────────────────────────────────
const Podium: React.FC<{
  entries: LeaderboardEntry[];
  myUserId?: string;
  colors: any;
}> = ({ entries, myUserId, colors }) => {
  const top3 = entries.slice(0, 3);
  // Reorder: 2nd, 1st, 3rd for visual podium effect
  const ordered = [top3[1], top3[0], top3[2]].filter(Boolean);
  const orderIndexMap = [1, 0, 2]; // original rank index

  return (
    <AppView style={styles.podiumRow}>
      {ordered.map((entry, viewIdx) => {
        const rankIdx = orderIndexMap[viewIdx];
        const isMe = entry?.userId === myUserId;
        const mc = MEDAL_COLOR[rankIdx] ?? colors.primary;

        return (
          <AppView
            key={entry?.userId ?? viewIdx}
            style={[styles.podiumItem, { justifyContent: 'flex-end' }]}
          >
            {/* User info above column */}
            <AppView center style={{ marginBottom: 8 }}>
              <AppView style={{ position: 'relative' }}>
                <Avatar
                  name={entry?.name ?? '?'}
                  size={rankIdx === 0 ? 60 : 48}
                  color={mc}
                />
                <AppText
                  style={{
                    position: 'absolute',
                    bottom: -6,
                    right: -4,
                    fontSize: rankIdx === 0 ? 20 : 16,
                  }}
                >
                  {MEDAL_EMOJI[rankIdx]}
                </AppText>
              </AppView>
              <AppText
                variant="caption1"
                weight="semiBold"
                numberOfLines={1}
                style={{
                  color: isMe ? colors.primary : colors.foreground,
                  marginTop: 10,
                  maxWidth: 80,
                  textAlign: 'center',
                }}
              >
                {isMe ? 'YOU' : entry?.name?.split(' ')[0]}
              </AppText>
              <AppText variant="caption2" style={{ color: mc, marginTop: 1 }}>
                {formatCoins(entry?.coinsBalance ?? 0)}
              </AppText>
            </AppView>

            {/* Column */}
            <AppView
              style={[
                styles.podiumColumn,
                {
                  height: PODIUM_HEIGHT[rankIdx],
                  backgroundColor: mc + '22',
                  borderTopLeftRadius: 10,
                  borderTopRightRadius: 10,
                  borderTopWidth: 3,
                  borderColor: mc,
                },
              ]}
            >
              <AppText variant="title3" weight="bold" style={{ color: mc }}>
                #{rankIdx + 1}
              </AppText>
            </AppView>
          </AppView>
        );
      })}
    </AppView>
  );
};

// ─── Rank row ─────────────────────────────────────────────────────────────────
const RankRow: React.FC<{
  entry: LeaderboardEntry;
  isMe: boolean;
  colors: any;
}> = ({ entry, isMe, colors }) => (
  <AppView
    style={[
      styles.rankRow,
      {
        backgroundColor: isMe ? colors.primary + '12' : colors.card,
        borderColor: isMe ? colors.primary + '50' : colors.border,
      },
    ]}
  >
    {/* Rank number */}
    <AppView
      style={[
        styles.rankBadge,
        {
          backgroundColor:
            entry.rank <= 3
              ? MEDAL_COLOR[entry.rank - 1] + '22'
              : colors.border,
        },
      ]}
    >
      <AppText
        variant="footnote"
        weight="bold"
        style={{
          color:
            entry.rank <= 3 ? MEDAL_COLOR[entry.rank - 1] : colors.foreground,
        }}
      >
        #{entry.rank}
      </AppText>
    </AppView>

    {/* Avatar */}
    <Avatar
      name={entry.name}
      size={40}
      color={isMe ? colors.primary : colors.foreground + '80'}
    />

    {/* Name & streak */}
    <AppView style={{ flex: 1, marginLeft: 12 }}>
      <AppText variant="callout" weight="semiBold" numberOfLines={1}>
        {isMe ? `${entry.name} (You)` : entry.name}
      </AppText>
      <AppText variant="caption1" style={{ opacity: 0.55, marginTop: 1 }}>
        🔥 {entry.streakDays}d streak · {entry.badgesCount} badge
        {entry.badgesCount !== 1 ? 's' : ''}
      </AppText>
    </AppView>

    {/* Coins */}
    <AppView style={{ alignItems: 'flex-end' }}>
      <AppText
        variant="callout"
        weight="bold"
        style={{ color: isMe ? colors.primary : colors.foreground }}
      >
        {formatCoins(entry.coinsBalance)}
      </AppText>
      <AppText variant="caption2" style={{ opacity: 0.45 }}>
        coins
      </AppText>
    </AppView>
  </AppView>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
const LeaderboardScreen: React.FC = () => {
  const { colors } = useTheme();
  const { entries, myEntry, isLoading, isRefetching, refetch } =
    useLeaderboard();

  const below3 = entries.slice(3);

  return (
    <Screen
      scroll
      safeArea={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
      header={<Header title="Leaderboard" showBack backLabel="" />}
    >
      <AppView style={styles.container}>
        {/* Header banner */}
        <AppView
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.primary + '14',
              borderColor: colors.primary + '30',
            },
          ]}
        >
          <AppText variant="title2" weight="bold" align="center">
            🏆 Top Athletes
          </AppText>
          <AppText
            variant="callout"
            align="center"
            style={{ opacity: 0.65, marginTop: 4 }}
          >
            Earn coins & maintain streaks to climb the ranks!
          </AppText>
        </AppView>

        {/* Podium */}
        {entries.length >= 3 && (
          <Podium
            entries={entries}
            myUserId={myEntry?.userId}
            colors={colors}
          />
        )}

        {/* Ranked list (4+) */}
        {below3.length > 0 && (
          <AppView style={{ marginTop: 12, gap: 8 }}>
            <AppText
              variant="footnote"
              weight="semiBold"
              style={{ opacity: 0.5, letterSpacing: 0.5, marginBottom: 4 }}
            >
              FULL RANKINGS
            </AppText>
            {below3.map(entry => (
              <RankRow
                key={entry.userId}
                entry={entry}
                isMe={entry.userId === myEntry?.userId}
                colors={colors}
              />
            ))}
          </AppView>
        )}

        {/* My pinned rank (if not in top 20) */}
        {myEntry && myEntry.rank > 20 && (
          <AppView style={{ marginTop: 16 }}>
            <AppText
              variant="footnote"
              style={{ opacity: 0.5, marginBottom: 6 }}
            >
              YOUR RANK
            </AppText>
            <RankRow entry={myEntry} isMe={true} colors={colors} />
          </AppView>
        )}

        {entries.length === 0 && !isLoading && (
          <AppView center style={{ marginTop: 60, gap: 8 }}>
            <AppText style={{ fontSize: 48 }}>🏆</AppText>
            <AppText variant="title3" align="center">
              No data yet
            </AppText>
            <AppText align="center" style={{ opacity: 0.55 }}>
              Start tracking and earning coins to appear here!
            </AppText>
          </AppView>
        )}

        <AppView style={{ height: 40 }} />
      </AppView>
    </Screen>
  );
};

export default LeaderboardScreen;

const styles = StyleSheet.create({
  container: { paddingTop: 12 },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 20,
  },
  podiumItem: {
    flex: 1,
    alignItems: 'center',
  },
  podiumColumn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
