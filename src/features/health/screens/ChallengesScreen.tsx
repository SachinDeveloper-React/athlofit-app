import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
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

const ChallengesScreen: React.FC = () => {
  const { colors } = useTheme();

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

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginVertical: 16,
  },
  bannerItem: { flex: 1, alignItems: 'center', gap: 3 },
  bannerDivider: { width: 1, marginVertical: 6 },
  filterRow: { gap: 8, paddingBottom: 4, marginBottom: 8 },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  pillEmoji: { fontSize: 13 },
  section: { marginBottom: 24 },
  sectionTitle: { marginBottom: 12 },
  list: { gap: 10 },
  loader: { paddingVertical: 60, alignItems: 'center' },
  empty: { paddingVertical: 60, alignItems: 'center', paddingHorizontal: 32 },
});
