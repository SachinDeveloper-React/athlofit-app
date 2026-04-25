// Compact challenge card shown inside NutritionAndGoalSection
import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText } from '../../../../components';
import { Icon } from '../../../../components/Icon';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { useChallenges } from '../../hooks/useChallenges';
import { navigate } from '../../../../navigation/navigationRef';
import { HealthRoutes, RootRoutes } from '../../../../navigation/routes';
import type { Challenge } from '../../types/challenge.types';

const NUTRITION_CRITERIA = new Set([
  'MEALS_LOGGED',
  'NUTRITION_CALORIES',
  'NUTRITION_PROTEIN',
  'NUTRITION_DAYS',
  'SPECIFIC_FOOD',
]);

const MiniCard = memo(({ c, index }: { c: Challenge; index: number }) => {
  const { colors } = useTheme();
  const pct = Math.min(1, c.targetValue > 0 ? c.currentValue / c.targetValue : 0);

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(300)}>
      <Pressable
        onPress={() => navigate(RootRoutes.HEALTH_NAVIGATOR, { screen: HealthRoutes.CHALLENGE_DETAIL, params: { challengeId: c._id } } as any)}
        style={[styles.miniCard, { backgroundColor: colors.background, borderColor: c.isCompleted ? withOpacity(c.color, 0.4) : colors.border }]}
      >
        <AppText style={styles.miniEmoji}>{c.emoji}</AppText>
        <View style={{ flex: 1 }}>
          <AppText variant="caption1" weight="semiBold" numberOfLines={1}>{c.title}</AppText>
          <View style={[styles.barTrack, { backgroundColor: colors.secondary, marginTop: 4 }]}>
            <View style={[styles.barFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: c.isCompleted ? '#10B981' : c.color }]} />
          </View>
        </View>
        <View style={styles.rewardWrap}>
          <AppText style={{ fontSize: 10 }}>🪙</AppText>
          <AppText variant="caption2" weight="bold" style={{ color: c.isRewarded ? '#10B981' : '#F5C518' }}>
            {c.isRewarded ? '✓' : `+${c.coinReward}`}
          </AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
});
MiniCard.displayName = 'MiniCard';

const ChallengeNutritionCard = memo(() => {
  const { colors } = useTheme();
  const { data: challenges, isLoading } = useChallenges();

  const nutritionChallenges = (challenges ?? []).filter(c =>
    NUTRITION_CRITERIA.has(c.criteriaType),
  );

  if (isLoading || nutritionChallenges.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Icon name="Trophy" size={14} color={colors.primary} />
        <AppText variant="overline" style={{ marginLeft: 6, color: colors.mutedForeground }}>
          NUTRITION CHALLENGES
        </AppText>
        <Pressable
          onPress={() => navigate(RootRoutes.HEALTH_NAVIGATOR, { screen: HealthRoutes.CHALLENGES } as any)}
          style={{ marginLeft: 'auto' }}
        >
          <AppText variant="caption1" style={{ color: colors.primary }}>See all →</AppText>
        </Pressable>
      </View>
      <View style={styles.list}>
        {nutritionChallenges.map((c, i) => (
          <MiniCard key={c._id} c={c} index={i} />
        ))}
      </View>
    </View>
  );
});

ChallengeNutritionCard.displayName = 'ChallengeNutritionCard';
export default ChallengeNutritionCard;

const styles = StyleSheet.create({
  container: { marginTop: 4 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  list: { gap: 8 },
  miniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  miniEmoji: { fontSize: 20 },
  barTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  rewardWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
