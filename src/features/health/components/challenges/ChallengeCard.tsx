import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText } from '../../../../components';
import { Icon } from '../../../../components/Icon';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import type { Challenge } from '../../types/challenge.types';
import { makeStyles } from '../../../../hooks/makeStyles';

type Props = {
  challenge: Challenge;
  index: number;
  onPress: (c: Challenge) => void;
};

const useStyles = makeStyles(({ colors, spacing, radius }) => ({
  card: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderRadius: radius.xl,
    padding: spacing[3] ?? 14,
    gap: spacing[3],
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emoji: { fontSize: 24 },
  content: { flex: 1 },
  titleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing[2] },
  typeBadge: { paddingHorizontal: spacing[1.25] ?? 7, paddingVertical: spacing[0.5], borderRadius: radius.sm },
  barTrack: { height: 5, borderRadius: spacing[0.5] ?? 3, overflow: 'hidden' as const },
  barFill: { height: 5, borderRadius: spacing[0.5] ?? 3 },
  bottomRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginTop: spacing[1.25] ?? 5 },
  rewardRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing[0.5] ?? 3 },
  coinEmoji: { fontSize: 11 },
  check: { width: 32, height: 32, borderRadius: radius.full, alignItems: 'center' as const, justifyContent: 'center' as const },
}));

const ChallengeCard = memo(({ challenge, index, onPress }: Props) => {
  const { colors } = useTheme();
  const styles = useStyles();
  const pct = Math.min(1, challenge.targetValue > 0 ? challenge.currentValue / challenge.targetValue : 0);
  const pctDisplay = Math.round(pct * 100);
  const { isCompleted, isRewarded } = challenge;

  // Ensure progress bar color is always visible — fallback to primary if missing
  const barColor = challenge.color && challenge.color.length > 0 ? challenge.color : colors.primary;

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
            borderColor: isCompleted ? withOpacity(barColor, 0.4) : colors.border,
            borderWidth: isCompleted ? 1.5 : StyleSheet.hairlineWidth,
          },
        ]}
        android_ripple={{ color: withOpacity(barColor, 0.08) }}
      >
        <View style={[styles.iconWrap, { backgroundColor: withOpacity(barColor, 0.12) }]}>
          <AppText style={styles.emoji}>{challenge.emoji}</AppText>
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <AppText variant="subhead" weight="semiBold" numberOfLines={1} style={{ flex: 1 }}>
              {challenge.title}
            </AppText>
            <View style={[styles.typeBadge, { backgroundColor: typeBadgeBg }]}>
              <AppText variant="caption2" weight="semiBold" style={{ color: typeBadgeColor }}>
                {challenge.type === 'daily' ? 'Daily' : 'Weekly'}
              </AppText>
            </View>
          </View>

          <AppText variant="caption1" style={{ color: colors.mutedForeground, marginTop: 2 }} numberOfLines={1}>
            {challenge.description}
          </AppText>

          <View style={[styles.barTrack, { backgroundColor: withOpacity(colors.foreground, 0.08), marginTop: 8 }]}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${pctDisplay}%` as any,
                  backgroundColor: isCompleted ? '#10B981' : barColor,
                },
              ]}
            />
          </View>

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
