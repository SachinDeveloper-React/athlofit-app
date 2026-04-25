// Compact challenge widget shown in the Daily Stats tab
import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText, AppView } from '../../../../components';
import { Icon } from '../../../../components/Icon';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { useQuery } from '@tanstack/react-query';
import { challengeService } from '../../service/challenge.service';
import { navigate } from '../../../../navigation/navigationRef';
import { HealthRoutes, RootRoutes } from '../../../../navigation/routes';
import type { Challenge } from '../../types/challenge.types';

const FITNESS_CRITERIA = new Set(['STEPS', 'CALORIES', 'ACTIVE_MINUTES', 'DISTANCE', 'HYDRATION']);

const MiniRow = memo(({ c, index }: { c: Challenge; index: number }) => {
  const { colors } = useTheme();
  const pct = Math.min(1, c.targetValue > 0 ? c.currentValue / c.targetValue : 0);

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <Pressable
        onPress={() => navigate(RootRoutes.HEALTH_NAVIGATOR, {
          screen: HealthRoutes.CHALLENGE_DETAIL,
          params: { challengeId: c._id },
        } as any)}
        style={[styles.row, { borderBottomColor: colors.border }]}
      >
        <AppText style={styles.emoji}>{c.emoji}</AppText>
        <View style={{ flex: 1 }}>
          <AppText variant="caption1" weight="semiBold" numberOfLines={1}>{c.title}</AppText>
          <View style={[styles.bar, { backgroundColor: colors.secondary, marginTop: 4 }]}>
            <View style={[styles.fill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: c.isCompleted ? '#10B981' : c.color }]} />
          </View>
        </View>
        <View style={styles.right}>
          {c.isCompleted
            ? <Icon name="CheckCircle2" size={16} color="#10B981" />
            : <AppText variant="caption2" style={{ color: colors.mutedForeground }}>{Math.round(pct * 100)}%</AppText>}
          <AppText style={styles.coin}>🪙{c.isRewarded ? '✓' : c.coinReward}</AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
});
MiniRow.displayName = 'MiniRow';

const ChallengeTrackerCard = memo(() => {
  const { colors } = useTheme();

  // useQuery — staleTime:0 so invalidation immediately triggers a fresh fetch
  const { data, isLoading } = useQuery({
    queryKey: ['challenges'],
    queryFn:  () => challengeService.getAll(),
    select:   r  => r.data ?? [],
    staleTime: 0,
    retry: 1,
  });

  const fitnessChallenges = (data ?? [])
    .filter(c => c.type === 'daily' && FITNESS_CRITERIA.has(c.criteriaType))
    .slice(0, 4);

  if (isLoading || fitnessChallenges.length === 0) return null;

  const completed = fitnessChallenges.filter(c => c.isCompleted).length;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: withOpacity(colors.primary, 0.1) }]}>
          <Icon name="Trophy" size={14} color={colors.primary} />
        </View>
        <AppText variant="subhead" weight="semiBold" style={{ flex: 1, marginLeft: 8 }}>
          Daily Challenges
        </AppText>
        <AppText variant="caption2" style={{ color: colors.mutedForeground }}>
          {completed}/{fitnessChallenges.length}
        </AppText>
        <Pressable
          onPress={() => navigate(RootRoutes.HEALTH_NAVIGATOR, { screen: HealthRoutes.CHALLENGES } as any)}
          style={{ marginLeft: 10 }}
        >
          <AppText variant="caption1" style={{ color: colors.primary }}>All →</AppText>
        </Pressable>
      </View>

      {/* Progress bar for overall */}
      <View style={[styles.overallBar, { backgroundColor: colors.secondary }]}>
        <View style={[styles.overallFill, { width: `${Math.round((completed / fitnessChallenges.length) * 100)}%` as any }]} />
      </View>

      {/* Challenge rows */}
      {fitnessChallenges.map((c, i) => (
        <MiniRow key={c._id} c={c} index={i} />
      ))}
    </View>
  );
});

ChallengeTrackerCard.displayName = 'ChallengeTrackerCard';
export default ChallengeTrackerCard;

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  headerIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  overallBar: { height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 12 },
  overallFill: { height: 4, borderRadius: 2, backgroundColor: '#10B981' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  emoji: { fontSize: 18, width: 24, textAlign: 'center' },
  bar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  right: { alignItems: 'flex-end', gap: 2 },
  coin: { fontSize: 10, color: '#F5C518' },
});
