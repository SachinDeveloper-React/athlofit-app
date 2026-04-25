import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { AppText, Header, Screen } from '../../../components';
import { Icon } from '../../../components/Icon';
import { useTheme } from '../../../hooks/useTheme';
import { withOpacity } from '../../../utils/withOpacity';
import { useChallengeDetail } from '../hooks/useChallenges';
import type { HealthStackParamList } from '../../../types/navigation.types';
import { HealthRoutes } from '../../../navigation/routes';

type RouteT = RouteProp<HealthStackParamList, typeof HealthRoutes.CHALLENGE_DETAIL>;

const CRITERIA_LABELS: Record<string, { label: string; unit: string; icon: string }> = {
  STEPS:              { label: 'Steps',              unit: 'steps', icon: 'Footprints'      },
  CALORIES:           { label: 'Active Calories',    unit: 'kcal',  icon: 'Flame'           },
  HYDRATION:          { label: 'Water Intake',       unit: 'ml',    icon: 'Droplets'        },
  ACTIVE_MINUTES:     { label: 'Active Minutes',     unit: 'min',   icon: 'Timer'           },
  DISTANCE:           { label: 'Distance',           unit: 'km',    icon: 'MapPin'          },
  MEALS_LOGGED:       { label: 'Meals Logged',       unit: 'meals', icon: 'UtensilsCrossed' },
  NUTRITION_CALORIES: { label: 'Calories Logged',    unit: 'kcal',  icon: 'Salad'           },
  NUTRITION_PROTEIN:  { label: 'Protein Logged',     unit: 'g',     icon: 'Beef'            },
  NUTRITION_DAYS:     { label: 'Days with Meals',    unit: 'days',  icon: 'CalendarCheck'   },
  SPECIFIC_FOOD:      { label: 'Food Logged',        unit: 'times', icon: 'Egg'             },
};

const ChallengeDetailScreen: React.FC = () => {
  const { colors } = useTheme();
  const route = useRoute<RouteT>();
  const { challengeId } = route.params as any;
  const { data: challenge, isPending } = useChallengeDetail(challengeId);

  if (isPending || !challenge) {
    return (
      <Screen safeArea={false} header={<Header title="Challenge" showBack backLabel="" />}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const pct = Math.min(1, challenge.targetValue > 0 ? challenge.currentValue / challenge.targetValue : 0);
  const pctDisplay = Math.round(pct * 100);
  const meta = CRITERIA_LABELS[challenge.criteriaType] ?? { label: challenge.criteriaType, unit: '', icon: 'Activity' };
  // For SPECIFIC_FOOD, show the food name in the label
  const metaLabel = challenge.criteriaType === 'SPECIFIC_FOOD' && challenge.targetFood
    ? `Log "${challenge.targetFood}" in meals`
    : meta.label;

  return (
    <Screen scroll safeArea={false} header={<Header title="Challenge Detail" showBack backLabel="" />}>

      {/* Hero card */}
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={[styles.hero, { backgroundColor: withOpacity(challenge.color, 0.1), borderColor: withOpacity(challenge.color, 0.25) }]}
      >
        <AppText style={styles.heroEmoji}>{challenge.emoji}</AppText>
        <AppText variant="title2" weight="bold" align="center" style={{ marginTop: 12 }}>
          {challenge.title}
        </AppText>
        <AppText variant="body" align="center" style={{ color: colors.mutedForeground, marginTop: 6, lineHeight: 22 }}>
          {challenge.description}
        </AppText>

        {/* Type + reward row */}
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: challenge.type === 'daily' ? withOpacity('#0099FF', 0.12) : withOpacity('#8B5CF6', 0.12) }]}>
            <AppText variant="caption1" weight="semiBold" style={{ color: challenge.type === 'daily' ? '#0099FF' : '#8B5CF6' }}>
              {challenge.type === 'daily' ? '🌅 Daily' : '📅 Weekly'}
            </AppText>
          </View>
          <View style={[styles.badge, { backgroundColor: withOpacity('#F5C518', 0.12) }]}>
            <AppText variant="caption1" weight="semiBold" style={{ color: '#B45309' }}>
              🪙 {challenge.coinReward} coins
            </AppText>
          </View>
        </View>
      </Animated.View>

      {/* Progress card */}
      <Animated.View
        entering={FadeInUp.delay(100).duration(400)}
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.metaIcon, { backgroundColor: withOpacity(challenge.color, 0.12) }]}>
            <Icon name={meta.icon as any} size={20} color={challenge.color} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <AppText variant="subhead" weight="semiBold">{metaLabel}</AppText>
            <AppText variant="caption1" style={{ color: colors.mutedForeground }}>
              Target: {challenge.targetValue.toLocaleString()} {meta.unit}
            </AppText>
          </View>
          <AppText variant="title3" weight="bold" style={{ color: challenge.color }}>
            {pctDisplay}%
          </AppText>
        </View>

        {/* Big progress bar */}
        <View style={[styles.bigBarTrack, { backgroundColor: colors.secondary, marginTop: 16 }]}>
          <View
            style={[
              styles.bigBarFill,
              { width: `${pctDisplay}%` as any, backgroundColor: challenge.isCompleted ? '#10B981' : challenge.color },
            ]}
          />
        </View>

        {/* Current vs target */}
        <View style={styles.progressNumbers}>
          <AppText variant="caption1" style={{ color: colors.mutedForeground }}>
            {challenge.currentValue.toLocaleString()} {meta.unit}
          </AppText>
          <AppText variant="caption1" style={{ color: colors.mutedForeground }}>
            {challenge.targetValue.toLocaleString()} {meta.unit}
          </AppText>
        </View>
      </Animated.View>

      {/* Status card */}
      <Animated.View
        entering={FadeInUp.delay(180).duration(400)}
        style={[
          styles.card,
          {
            backgroundColor: challenge.isCompleted ? withOpacity('#10B981', 0.07) : withOpacity(colors.primary, 0.05),
            borderColor: challenge.isCompleted ? withOpacity('#10B981', 0.3) : colors.border,
          },
        ]}
      >
        <View style={styles.statusRow}>
          <Icon
            name={challenge.isCompleted ? 'CheckCircle2' : 'Clock'}
            size={22}
            color={challenge.isCompleted ? '#10B981' : colors.mutedForeground}
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <AppText variant="subhead" weight="semiBold" style={{ color: challenge.isCompleted ? '#10B981' : colors.foreground }}>
              {challenge.isCompleted ? 'Challenge Completed!' : 'In Progress'}
            </AppText>
            <AppText variant="caption1" style={{ color: colors.mutedForeground, marginTop: 2 }}>
              {challenge.isRewarded
                ? `🪙 ${challenge.coinReward} coins have been added to your wallet`
                : challenge.isCompleted
                ? 'Coins will be credited automatically'
                : `Complete to earn ${challenge.coinReward} coins`}
            </AppText>
          </View>
        </View>
      </Animated.View>

      {/* How to complete */}
      <Animated.View
        entering={FadeInUp.delay(240).duration(400)}
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <AppText variant="headline" weight="semiBold" style={{ marginBottom: 12 }}>How to Complete</AppText>
        {[
          { icon: 'Activity', text: `Track your ${meta.label.toLowerCase()} through the app` },
          { icon: 'RefreshCw', text: 'Progress updates automatically when you sync health data' },
          { icon: 'Coins', text: `Earn ${challenge.coinReward} coins automatically on completion` },
          { icon: 'RotateCcw', text: `Resets ${challenge.type === 'daily' ? 'every day at midnight' : 'every Monday'}` },
        ].map((item, i) => (
          <View key={i} style={[styles.howRow, i > 0 && { marginTop: 12 }]}>
            <View style={[styles.howIcon, { backgroundColor: withOpacity(colors.primary, 0.1) }]}>
              <Icon name={item.icon as any} size={15} color={colors.primary} />
            </View>
            <AppText variant="subhead" style={{ flex: 1, marginLeft: 10, color: colors.foreground, lineHeight: 20 }}>
              {item.text}
            </AppText>
          </View>
        ))}
      </Animated.View>

      <View style={{ height: 40 }} />
    </Screen>
  );
};

export default ChallengeDetailScreen;

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 300 },
  hero: { borderRadius: 20, borderWidth: 1, padding: 24, alignItems: 'center', marginBottom: 16 },
  heroEmoji: { fontSize: 56 },
  badgeRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  metaIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bigBarTrack: { height: 10, borderRadius: 5, overflow: 'hidden' },
  bigBarFill: { height: 10, borderRadius: 5 },
  progressNumbers: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start' },
  howRow: { flexDirection: 'row', alignItems: 'flex-start' },
  howIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
