import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText } from '../../../../components';
import { Icon } from '../../../../components/Icon';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import type { Challenge } from '../../types/challenge.types';

type Props = {
  challenge: Challenge;
  index: number;
  onPress: (c: Challenge) => void;
};

const ChallengeCard = memo(({ challenge, index, onPress }: Props) => {
  const { colors } = useTheme();
  const pct = Math.min(1, challenge.targetValue > 0 ? challenge.currentValue / challenge.targetValue : 0);
  const pctDisplay = Math.round(pct * 100);
  const { isCompleted, isRewarded } = challenge;

  const typeBadgeBg = challenge.type === 'daily'
    ? withOpacity('#0099FF', 0.12)
    : withOpacity('#8B5CF6', 0.12);
  const typeBadgeColor = challenge.type === 'daily' ? '#0099FF' : '#8B5CF6';

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(350)}>
      <Pressable
        onPress={() => onPress(challenge)}
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: isCompleted ? withOpacity(challenge.color, 0.4) : colors.border,
            borderWidth: isCompleted ? 1.5 : StyleSheet.hairlineWidth,
          },
        ]}
        android_ripple={{ color: withOpacity(challenge.color, 0.08) }}
      >
        {/* Left icon */}
        <View style={[styles.iconWrap, { backgroundColor: withOpacity(challenge.color, 0.12) }]}>
          <AppText style={styles.emoji}>{challenge.emoji}</AppText>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <AppText variant="subhead" weight="semiBold" numberOfLines={1} style={{ flex: 1 }}>
              {challenge.title}
            </AppText>
            {/* Type badge */}
            <View style={[styles.typeBadge, { backgroundColor: typeBadgeBg }]}>
              <AppText variant="caption2" weight="semiBold" style={{ color: typeBadgeColor }}>
                {challenge.type === 'daily' ? 'Daily' : 'Weekly'}
              </AppText>
            </View>
          </View>

          <AppText variant="caption1" style={{ color: colors.mutedForeground, marginTop: 2 }} numberOfLines={1}>
            {challenge.description}
          </AppText>

          {/* Progress bar */}
          <View style={[styles.barTrack, { backgroundColor: colors.secondary, marginTop: 8 }]}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${pctDisplay}%` as any,
                  backgroundColor: isCompleted ? '#10B981' : challenge.color,
                },
              ]}
            />
          </View>

          {/* Progress text + reward */}
          <View style={styles.bottomRow}>
            <AppText variant="caption2" style={{ color: colors.mutedForeground }}>
              {isCompleted ? '✓ Completed' : `${pctDisplay}% · ${challenge.currentValue.toLocaleString()} / ${challenge.targetValue.toLocaleString()}`}
            </AppText>
            <View style={styles.rewardRow}>
              <AppText style={styles.coinEmoji}>🪙</AppText>
              <AppText
                variant="caption2"
                weight="bold"
                style={{ color: isRewarded ? '#10B981' : '#F5C518' }}
              >
                {isRewarded ? 'Earned!' : `+${challenge.coinReward}`}
              </AppText>
            </View>
          </View>
        </View>

        {/* Completed checkmark */}
        {isCompleted && (
          <View style={[styles.check, { backgroundColor: withOpacity('#10B981', 0.12) }]}>
            <Icon name="CheckCircle2" size={18} color="#10B981" />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
});

ChallengeCard.displayName = 'ChallengeCard';
export default ChallengeCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 24 },
  content: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  barTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 5, borderRadius: 3 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  coinEmoji: { fontSize: 11 },
  check: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
