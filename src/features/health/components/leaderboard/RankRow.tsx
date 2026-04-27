import React from 'react';
import { AppText, AppView } from '../../../../components';
import { formatCoins } from '../../../../config/appConfig';
import type { LeaderboardEntry } from '../../types/leaderboard.types';
import Avatar from './Avatar';
import { makeStyles } from '../../../../hooks/makeStyles';

const MEDAL_COLOR = ['#FFD700', '#C0C0C0', '#CD7F32'];

type Props = {
  entry: LeaderboardEntry;
  isMe: boolean;
  colors: any;
};

const useStyles = makeStyles(({ colors, spacing, radius }) => ({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: spacing[3],
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing[2],
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
}));

const RankRow: React.FC<Props> = ({ entry, isMe, colors }) => {
  const styles = useStyles();
  return (
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
};

export default RankRow;
