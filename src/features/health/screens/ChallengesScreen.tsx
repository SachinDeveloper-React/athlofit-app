import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText, Header, Screen } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { withOpacity } from '../../../utils/withOpacity';
import { useChallenges, useChallengeConfig } from '../hooks/useChallenges';
import ChallengeCard from '../components/challenges/ChallengeCard';
import type { Challenge } from '../types/challenge.types';
import { HealthRoutes, RootRoutes } from '../../../navigation/routes';
import { navigate } from '../../../navigation/navigationRef';
import { makeStyles } from '../../../hooks/makeStyles';

const useStyles = makeStyles(({ colors, spacing, radius }) => ({
  banner: {
    flexDirection: 'row' as const,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing[3.5 as any] ?? 14,
    marginVertical: spacing[4],
  },
  bannerItem: { flex: 1, alignItems: 'center' as const, gap: spacing[0.75 as any] ?? 3 },
  bannerDivider: { width: 1, marginVertical: spacing[1.5] },
  filterRow: { gap: spacing[2], paddingBottom: spacing[1], marginBottom: spacing[2] },
  typePill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[1.25 as any] ?? 5,
    paddingHorizontal: spacing[3.5 as any] ?? 14,
    paddingVertical: spacing[2],
    borderRadius: radius['2xl'],
    borderWidth: 1,
  },
  catPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  pillEmoji: { fontSize: 13 },
  section: { marginBottom: spacing[6] },
  sectionTitle: { marginBottom: spacing[3] },
  list: { gap: spacing[2.5] },
  loader: { paddingVertical: spacing[15 as any] ?? 60, alignItems: 'center' as const },
  empty: { paddingVertical: spacing[15 as any] ?? 60, alignItems: 'center' as const, paddingHorizontal: spacing[8] },
}));

const ChallengesScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useStyles();

  const [typeFilter, setTypeFilter] = useState('all');
  const [catFilter,  setCatFilter]  = useState('all');

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: challenges = [], isPending, refetch } = useChallenges();
  const { data: config, isLoading: configLoading } = useChallengeConfig();

  const load = useCallback(() => refetch(), [refetch]);

  // ── Filters from API ──────────────────────────────────────────────────────
  const typeFilters    = config?.typeFilters    ?? [{ key: 'all', label: 'All', emoji: '🏆' }];
  const catFilters     = config?.catFilters     ?? [{ key: 'all', label: 'All', emoji: '✨' }];
  const sectionLabels  = config?.sectionLabels  ?? {};

  // ── Apply filters ─────────────────────────────────────────────────────────
  const filtered = useMemo(() =>
    challenges.filter(c => {
      const typeOk = typeFilter === 'all' || c.type     === typeFilter;
      const catOk  = catFilter  === 'all' || c.category === catFilter;
      return typeOk && catOk;
    }),
    [challenges, typeFilter, catFilter],
  );

  // Group by "type-category"
  const grouped = useMemo(() => {
    const map: Record<string, Challenge[]> = {};
    filtered.forEach(c => {
      const key = `${c.type}-${c.category}`;
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return map;
  }, [filtered]);

  const sectionKeys = Object.keys(grouped).sort();

  // ── Stats ─────────────────────────────────────────────────────────────────
  const completed       = challenges.filter(c => c.isCompleted).length;
  const total           = challenges.length;
  const coinsEarned     = challenges.filter(c => c.isRewarded).reduce((s, c) => s + c.coinReward, 0);
  const coinsAvailable  = challenges.filter(c => !c.isRewarded).reduce((s, c) => s + c.coinReward, 0);

  const handlePress = useCallback((c: Challenge) => {
    navigate(RootRoutes.HEALTH_NAVIGATOR, {
      screen: HealthRoutes.CHALLENGE_DETAIL,
      params: { challengeId: c._id },
    } as any);
  }, []);

  return (
    <Screen
      scroll
      safeArea={false}
      header={<Header title="Challenges" showBack backLabel="" />}
      refreshControl={
        <RefreshControl refreshing={isPending} onRefresh={load} tintColor={colors.primary} />
      }
    >
      {/* ── Stats banner ── */}
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={[styles.banner, { backgroundColor: withOpacity(colors.primary, 0.07), borderColor: withOpacity(colors.primary, 0.18) }]}
      >
        {[
          { label: 'Done',      value: `${completed}`,       color: colors.primary },
          { label: 'Total',     value: `${total}`,            color: colors.foreground },
          { label: 'Earned',    value: `🪙 ${coinsEarned}`,   color: '#10B981' },
          { label: 'Available', value: `🪙 ${coinsAvailable}`,color: '#F5C518' },
        ].map((s, i, arr) => (
          <React.Fragment key={s.label}>
            <View style={styles.bannerItem}>
              <AppText variant="footnote" weight="bold" style={{ color: s.color }}>{s.value}</AppText>
              <AppText variant="caption2" style={{ color: colors.mutedForeground }}>{s.label}</AppText>
            </View>
            {i < arr.length - 1 && <View style={[styles.bannerDivider, { backgroundColor: colors.border }]} />}
          </React.Fragment>
        ))}
      </Animated.View>

      {/* ── Type filter (from API) ── */}
      {!configLoading && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {typeFilters.map(f => {
            const active = typeFilter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setTypeFilter(f.key)}
                style={[
                  styles.typePill,
                  { backgroundColor: active ? colors.primary : colors.secondary, borderColor: active ? colors.primary : colors.border },
                ]}
              >
                <AppText style={styles.pillEmoji}>{f.emoji}</AppText>
                <AppText variant="caption1" weight={active ? 'semiBold' : 'regular'} color={active ? '#fff' : undefined}>
                  {f.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* ── Category filter (from API) ── */}
      {!configLoading && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterRow, { marginBottom: 20 }]}>
          {catFilters.map(f => {
            const active = catFilter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setCatFilter(f.key)}
                style={[
                  styles.catPill,
                  {
                    backgroundColor: active ? withOpacity(colors.primary, 0.12) : 'transparent',
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <AppText style={{ fontSize: 12 }}>{f.emoji}</AppText>
                <AppText
                  variant="caption2"
                  weight={active ? 'semiBold' : 'regular'}
                  style={{ color: active ? colors.primary : colors.mutedForeground }}
                >
                  {f.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* ── Content ── */}
      {isPending && challenges.length === 0 ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText variant="subhead" style={{ color: colors.mutedForeground, marginTop: 12 }}>
            Loading challenges…
          </AppText>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <AppText style={{ fontSize: 48 }}>🏆</AppText>
          <AppText variant="title3" style={{ marginTop: 16 }}>No challenges found</AppText>
          <AppText variant="subhead" style={{ color: colors.mutedForeground, marginTop: 6, textAlign: 'center' }}>
            {challenges.length === 0 ? 'No challenges available yet.' : 'Try a different filter.'}
          </AppText>
        </View>
      ) : (
        sectionKeys.map(key => (
          <View key={key} style={styles.section}>
            {/* Section label from API */}
            <AppText variant="headline" weight="semiBold" style={styles.sectionTitle}>
              {sectionLabels[key] ?? key}
            </AppText>
            <View style={styles.list}>
              {grouped[key].map((c, i) => (
                <ChallengeCard key={c._id} challenge={c} index={i} onPress={handlePress} />
              ))}
            </View>
          </View>
        ))
      )}
    </Screen>
  );
};

export default ChallengesScreen;
