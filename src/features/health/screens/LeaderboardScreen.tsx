import React, { useCallback } from 'react';
import { StyleSheet, RefreshControl } from 'react-native';
import { AppText, AppView, Header, Screen } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { useLeaderboard } from '../hooks/useLeaderboard';
import Avatar from '../components/leaderboard/Avatar';
import Podium from '../components/leaderboard/Podium';
import RankRow from '../components/leaderboard/RankRow';

const LeaderboardScreen: React.FC = () => {
  const { colors } = useTheme();
  const { entries, myEntry, isLoading, isRefetching, refetch } = useLeaderboard();

  const below3 = entries.slice(3);

  return (
    <Screen
      scroll
      safeArea={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
      }
      header={<Header title="Leaderboard" showBack backLabel="" />}
    >
      <AppView style={styles.container}>
        {/* Hero banner */}
        <AppView style={[styles.heroCard, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '30' }]}>
          <AppText variant="title2" weight="bold" align="center">🏆 Top Athletes</AppText>
          <AppText variant="callout" align="center" style={{ opacity: 0.65, marginTop: 4 }}>
            Earn coins & maintain streaks to climb the ranks!
          </AppText>
        </AppView>

        {entries.length >= 3 && (
          <Podium entries={entries} myUserId={myEntry?.userId} colors={colors} />
        )}

        {below3.length > 0 && (
          <AppView style={{ marginTop: 12, gap: 8 }}>
            <AppText variant="footnote" weight="semiBold" style={{ opacity: 0.5, letterSpacing: 0.5, marginBottom: 4 }}>
              FULL RANKINGS
            </AppText>
            {below3.map(entry => (
              <RankRow key={entry.userId} entry={entry} isMe={entry.userId === myEntry?.userId} colors={colors} />
            ))}
          </AppView>
        )}

        {myEntry && myEntry.rank > 20 && (
          <AppView style={{ marginTop: 16 }}>
            <AppText variant="footnote" style={{ opacity: 0.5, marginBottom: 6 }}>YOUR RANK</AppText>
            <RankRow entry={myEntry} isMe={true} colors={colors} />
          </AppView>
        )}

        {entries.length === 0 && !isLoading && (
          <AppView center style={{ marginTop: 60, gap: 8 }}>
            <AppText style={{ fontSize: 48 }}>🏆</AppText>
            <AppText variant="title3" align="center">No data yet</AppText>
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
});
