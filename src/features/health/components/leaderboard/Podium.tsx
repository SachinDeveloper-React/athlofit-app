import React from 'react';
import { AppText, AppView } from '../../../../components';
import { formatCoins } from '../../../../config/appConfig';
import type { LeaderboardEntry } from '../../types/leaderboard.types';
import Avatar from './Avatar';

const MEDAL_COLOR = ['#FFD700', '#C0C0C0', '#CD7F32'];
const MEDAL_EMOJI = ['🥇', '🥈', '🥉'];
const PODIUM_HEIGHT = [110, 80, 60];

type Props = {
  entries: LeaderboardEntry[];
  myUserId?: string;
  colors: any;
};

const Podium: React.FC<Props> = ({ entries, myUserId, colors }) => {
  const top3 = entries.slice(0, 3);
  const ordered = [top3[1], top3[0], top3[2]].filter(Boolean);
  const orderIndexMap = [1, 0, 2];

  return (
    <AppView style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4, marginBottom: 20 }}>
      {ordered.map((entry, viewIdx) => {
        const rankIdx = orderIndexMap[viewIdx];
        const isMe = entry?.userId === myUserId;
        const mc = MEDAL_COLOR[rankIdx] ?? colors.primary;

        return (
          <AppView key={entry?.userId ?? viewIdx} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
            <AppView center style={{ marginBottom: 8 }}>
              <AppView style={{ position: 'relative' }}>
                <Avatar name={entry?.name ?? '?'} size={rankIdx === 0 ? 60 : 48} color={mc} />
                <AppText style={{ position: 'absolute', bottom: -6, right: -4, fontSize: rankIdx === 0 ? 20 : 16 }}>
                  {MEDAL_EMOJI[rankIdx]}
                </AppText>
              </AppView>
              <AppText
                variant="caption1"
                weight="semiBold"
                numberOfLines={1}
                style={{ color: isMe ? colors.primary : colors.foreground, marginTop: 10, maxWidth: 80, textAlign: 'center' }}
              >
                {isMe ? 'YOU' : entry?.name?.split(' ')[0]}
              </AppText>
              <AppText variant="caption2" style={{ color: mc, marginTop: 1 }}>
                {formatCoins(entry?.coinsBalance ?? 0)}
              </AppText>
            </AppView>
            <AppView
              style={{
                width: '100%',
                height: PODIUM_HEIGHT[rankIdx],
                backgroundColor: mc + '22',
                borderTopLeftRadius: 10,
                borderTopRightRadius: 10,
                borderTopWidth: 3,
                borderColor: mc,
                alignItems: 'center',
                justifyContent: 'center',
              }}
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

export default Podium;
