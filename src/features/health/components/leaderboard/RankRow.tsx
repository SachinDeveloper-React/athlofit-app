import React from 'react';
import { StyleSheet } from 'react-native';
import { AppText, AppView } from '../../../../components';
import { formatCoins } from '../../../../config/appConfig';
import type { LeaderboardEntry } from '../../types/leaderboard.types';
import Avatar from './Avatar';

const MEDAL_COLOR = ['#FFD700', '#C0C0C0', '#CD7F32'];

type Props = {
  entry: LeaderboardEntry;
  isMe: boolean;
  colors: any;
};

const RankRow: React.FC<Props> = ({ entry, isMe, colors }) => (
  <AppView
    style={[
      styles.row,
      {
        backgroundColor: isMe ? colors.primary + '12' : colors.card,
        borderColor: isMe ? colors.primary + '50' : colors.border,
      },
    ]}
  >
    <AppView
      style={[
        styles.badge,
        { backgroundColor: entry.rank <= 3 ? MEDAL_COLOR[entry.rank - 1] + '22' : colors.border },
      ]}
    >
      <AppText
        variant="footnote"
        weight="bold"
        style={{ color: entry.rank <= 3 ? MEDAL_COLOR[entry.rank - 1] : colors.foreground }}
      >
        #{entry.rank}
      </AppText>
    </AppView>

    <Avatar name={entry.name} size={40} color={isMe ? colors.primary : colors.foreground + '80'} />

    <AppView style={{ flex: 1, marginLeft: 12 }}>
      <AppText variant="callout" weight="semiBold" numberOfLines={1}>
        {isMe ? `${entry.name} (You)` : entry.name}
      </AppText>
      <AppText variant="caption1" style={{ opacity: 0.55, marginTop: 1 }}>
        🔥 {entry.streakDays}d streak · {entry.badgesCount} badge{entry.badgesCount !== 1 ? 's' : ''}
      </AppText>
    </AppView>

    <AppView style={{ alignItems: 'flex-end' }}>
      <AppText variant="callout" weight="bold" style={{ color: isMe ? colors.primary : colors.foreground }}>
        {formatCoins(entry.coinsBalance)}
      </AppText>
      <AppText variant="caption2" style={{ opacity: 0.45 }}>coins</AppText>
    </AppView>
  </AppView>
);

export default RankRow;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
