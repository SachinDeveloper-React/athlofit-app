// src/features/health/screens/StepDetailScreen.tsx
import React, { memo, useMemo } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import {
  Activity,
  Droplets,
  Flame,
  Heart,
  MapPin,
  Moon,
  Scale,
  Timer,
  Zap,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppText, Header, Screen } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { withOpacity } from '../../../utils/withOpacity';
import { makeStyles } from '../../../hooks/makeStyles';
import { useDayDetail } from '../hooks/useDayDetail';
import { getStepColor } from '../utils/stepColorUtils';
import type { HealthStackParamList } from '../../../types/navigation.types';
import { HealthRoutes } from '../../../navigation/routes';
import { useNetworkStore } from '../../../store/networkStore';

type Props = NativeStackScreenProps<HealthStackParamList, typeof HealthRoutes.STEP_DETAIL>;

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_W   = Dimensions.get('window').width;
const RING_SIZE  = SCREEN_W * 0.52;
const STROKE     = 18;
const RADIUS     = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today     = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  const isToday     = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday)     return 'Today';
  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month:   'long',
    day:     'numeric',
    year:    date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
  });
}

// ─── Circular progress ring ───────────────────────────────────────────────────

const ProgressRing = memo(({
  pct,
  steps,
  goal,
  barColor,
  isDark,
}: {
  pct: number;
  steps: number;
  goal: number;
  barColor: string;
  isDark: boolean;
}) => {
  const { colors } = useTheme();
  const dashOffset = CIRCUMFERENCE * (1 - Math.min(pct / 100, 1));
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;

  return (
    <View style={[styles.ringWrap, { width: RING_SIZE, height: RING_SIZE }]}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={barColor} stopOpacity="1" />
            <Stop offset="100%" stopColor={withOpacity(barColor, 0.6)} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        {/* Track */}
        <Circle
          cx={cx} cy={cy} r={RADIUS}
          fill="none"
          stroke={isDark ? '#2a2a2a' : '#efefef'}
          strokeWidth={STROKE}
        />
        {/* Progress */}
        <Circle
          cx={cx} cy={cy} r={RADIUS}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          rotation="-90"
          origin={`${cx}, ${cy}`}
        />
      </Svg>

      {/* Center text */}
      <View style={styles.ringCenter}>
        <AppText
          variant="largeTitle"
          weight="bold"
          style={{ color: barColor, fontSize: 32, lineHeight: 36 }}
        >
          {steps.toLocaleString()}
        </AppText>
        <AppText variant="caption1" style={{ color: colors.mutedForeground, marginTop: 2 }}>
          steps
        </AppText>
        <View style={[styles.goalPill, { backgroundColor: withOpacity(barColor, 0.12) }]}>
          <AppText variant="caption2" weight="semiBold" style={{ color: barColor }}>
            {pct}% of {goal.toLocaleString()}
          </AppText>
        </View>
      </View>
    </View>
  );
});
ProgressRing.displayName = 'ProgressRing';

// ─── Metric tile ──────────────────────────────────────────────────────────────

interface MetricTileProps {
  icon: React.ElementType;
  iconColor: string;
  label: string;
  value: string | number;
  unit: string;
  sub?: string;
  delay?: number;
}

const MetricTile = memo(({
  icon: Icon,
  iconColor,
  label,
  value,
  unit,
  sub,
  delay = 0,
}: MetricTileProps) => {
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(350)}
      style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.tileIcon, { backgroundColor: withOpacity(iconColor, 0.12) }]}>
        <Icon size={18} color={iconColor} />
      </View>
      <AppText variant="caption2" style={{ color: colors.mutedForeground, marginTop: 8 }}>
        {label}
      </AppText>
      <View style={styles.tileValueRow}>
        <AppText variant="title3" weight="bold" style={{ color: colors.foreground }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </AppText>
        {unit ? (
          <AppText variant="caption2" style={{ color: colors.mutedForeground, marginLeft: 3 }}>
            {unit}
          </AppText>
        ) : null}
      </View>
      {sub ? (
        <AppText variant="caption2" style={{ color: colors.mutedForeground, marginTop: 2 }}>
          {sub}
        </AppText>
      ) : null}
    </Animated.View>
  );
});
MetricTile.displayName = 'MetricTile';

// ─── Goal status banner ───────────────────────────────────────────────────────

const GoalBanner = memo(({
  goalMet,
  pct,
  barColor,
}: {
  goalMet: boolean;
  pct: number;
  barColor: string;
}) => {
  const { colors } = useTheme();
  const label = goalMet
    ? '🎯 Daily goal reached!'
    : pct >= 75 ? '💪 Almost there — keep going!'
    : pct >= 50 ? '🔥 Halfway to your goal!'
    : pct >= 25 ? '👟 Good start — keep moving!'
    : '🚶 Every step counts!';

  return (
    <Animated.View
      entering={FadeInUp.delay(100).duration(350)}
      style={[
        styles.banner,
        { backgroundColor: withOpacity(barColor, 0.1), borderColor: withOpacity(barColor, 0.25) },
      ]}
    >
      <AppText variant="subhead" weight="semiBold" style={{ color: barColor, textAlign: 'center' }}>
        {label}
      </AppText>
    </Animated.View>
  );
});
GoalBanner.displayName = 'GoalBanner';

// ─── Styles hook ──────────────────────────────────────────────────────────────

const useStyles = makeStyles(({ spacing }) => ({
  sectionTitle: {
    marginTop: spacing[5],
    marginBottom: spacing[3],
  },
}));

// ─── Screen ───────────────────────────────────────────────────────────────────

const StepDetailScreen = memo(({ route }: Props) => {
  const { date } = route.params;
  const { colors, isDark } = useTheme();
  const s = useStyles();
  const { data, isLoading } = useDayDetail(date);
  const isOnline = useNetworkStore(state => state.isOnline);

  const { barColor } = useMemo(
    () => getStepColor(data?.steps ?? 0, data?.dailyGoal ?? 10000, colors.muted, false),
    [data?.steps, data?.dailyGoal, colors.muted],
  );

  const headerTitle    = formatDate(date);
  const headerSubtitle = formatShortDate(date);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading && isOnline) {
    return (
      <Screen
        scroll={false}
        safeArea={false}
        header={
          <Header
            title={headerTitle}
            subtitle={headerSubtitle}
            showBack
            backLabel=""
          />
        }
      >
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText variant="subhead" style={{ color: colors.mutedForeground, marginTop: 12 }}>
            Loading day data…
          </AppText>
        </View>
      </Screen>
    );
  }

  // ── No data ────────────────────────────────────────────────────────────────
  if (!data || !data.hasData) {
    return (
      <Screen
        scroll={false}
        safeArea={false}
        header={
          <Header
            title={headerTitle}
            subtitle={headerSubtitle}
            showBack
            backLabel=""
          />
        }
      >
        <View style={styles.loadingWrap}>
          <Activity size={48} color={colors.mutedForeground} />
          <AppText variant="title3" style={{ color: colors.foreground, marginTop: 16 }}>
            No data for this day
          </AppText>
          <AppText
            variant="subhead"
            style={{ color: colors.mutedForeground, marginTop: 6, textAlign: 'center' }}
          >
            Sync your health data to see activity for {headerTitle.toLowerCase()}.
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      safeArea={false}
      header={
        <Header
          title={headerTitle}
          subtitle={headerSubtitle}
          showBack
          backLabel=""
        />
      }
    >
      {/* ── Progress ring ── */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.ringSection}>
        <ProgressRing
          pct={data.progressPct}
          steps={data.steps}
          goal={data.dailyGoal}
          barColor={barColor}
          isDark={isDark}
        />
      </Animated.View>

      {/* ── Goal banner ── */}
      <GoalBanner goalMet={data.goalMet} pct={data.progressPct} barColor={barColor} />

      {/* ── Activity metrics ── */}
      <AppText variant="headline" weight="semiBold" style={s.sectionTitle}>
        Activity
      </AppText>
      <View style={styles.grid}>
        <MetricTile
          icon={Flame}
          iconColor="#F97316"
          label="Calories Burned"
          value={data.calories}
          unit="kcal"
          delay={0}
        />
        <MetricTile
          icon={MapPin}
          iconColor="#10B981"
          label="Distance"
          value={data.distance.toFixed(2)}
          unit="km"
          delay={60}
        />
        <MetricTile
          icon={Timer}
          iconColor="#F59E0B"
          label="Active Time"
          value={data.activeMinutes}
          unit="min"
          delay={120}
        />
        <MetricTile
          icon={Zap}
          iconColor={barColor}
          label="Daily Goal"
          value={data.dailyGoal.toLocaleString()}
          unit="steps"
          sub={data.goalMet ? '✓ Completed' : `${data.progressPct}% done`}
          delay={180}
        />
      </View>

      {/* ── Vitals ── */}
      <AppText variant="headline" weight="semiBold" style={s.sectionTitle}>
        Vitals
      </AppText>
      <View style={styles.grid}>
        <MetricTile
          icon={Heart}
          iconColor="#EF4444"
          label="Heart Rate"
          value={data.heartRate || '—'}
          unit={data.heartRate ? 'bpm' : ''}
          sub={
            data.heartRateMin && data.heartRateMax
              ? `${data.heartRateMin}–${data.heartRateMax} bpm`
              : undefined
          }
          delay={0}
        />
        <MetricTile
          icon={Droplets}
          iconColor="#06B6D4"
          label="Hydration"
          value={data.hydration || '—'}
          unit={data.hydration ? 'ml' : ''}
          delay={60}
        />
        <MetricTile
          icon={Moon}
          iconColor="#8B5CF6"
          label="Sleep"
          value={data.sleepHours || '—'}
          unit={data.sleepHours ? 'hrs' : ''}
          delay={120}
        />
        <MetricTile
          icon={Activity}
          iconColor="#EC4899"
          label="Blood Glucose"
          value={data.bloodGlucose || '—'}
          unit={data.bloodGlucose ? 'mmol/L' : ''}
          delay={180}
        />
      </View>

      {/* ── Body ── */}
      {(data.weight > 0) && (
        <>
          <AppText variant="headline" weight="semiBold" style={s.sectionTitle}>
            Body
          </AppText>
          <View style={styles.grid}>
            <MetricTile
              icon={Scale}
              iconColor="#6366F1"
              label="Weight"
              value={data.weight}
              unit="kg"
              delay={0}
            />
          </View>
        </>
      )}
    </Screen>
  );
});

StepDetailScreen.displayName = 'StepDetailScreen';
export default StepDetailScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  ringSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  goalPill: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  banner: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
  },
  tile: {
    width: '47.5%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
});
