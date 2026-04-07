import React, { memo, useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  Flame,
  CheckCircle2,
  Lock,
  Award,
  Crown,
  Sparkles,
} from 'lucide-react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { AppText, AppView, Card } from '../../../../components';
import { SCREEN_WIDTH } from '../../../../utils/measure';
import { Radius, Spacing } from '../../../../constants/spacing';
import { FontSize } from '../../../../constants/typography';
import { Skeleton } from '../../../../components/SkeletonLoader';
import type { BadgeKey, TrackerBadge } from '../../types/gamification.type';

type Props = {
  streakDays: number;
  bestStreakDays: number;
  badges: TrackerBadge[];
  nextBadgeAt?: number;
};

const badgeIcon = (key: BadgeKey) => {
  switch (key) {
    case 'starter':
      return Sparkles;
    case 'consistent':
      return Award;
    case 'finisher':
      return Award;
    case 'elite':
      return Crown;
    default:
      return Award;
  }
};

export const TrackerStreaksBadges = memo(
  ({ streakDays, bestStreakDays, badges, nextBadgeAt = 7 }: Props) => {
    const { colors, spacing } = useTheme();

    // animations
    const appear = useSharedValue(0);
    const prog = useSharedValue(0);

    const progress = useMemo(() => {
      if (nextBadgeAt <= 0) return 0;
      return Math.min(1, streakDays / nextBadgeAt);
    }, [streakDays, nextBadgeAt]);

    const remain = useMemo(
      () => Math.max(0, nextBadgeAt - streakDays),
      [nextBadgeAt, streakDays],
    );

    // memo colors
    const glowBg = useMemo(
      () => withOpacity(colors.primary, 0.14),
      [colors.primary],
    );
    const fg45 = useMemo(
      () => withOpacity(colors.foreground, 0.45),
      [colors.foreground],
    );
    const fg55 = useMemo(
      () => withOpacity(colors.foreground, 0.55),
      [colors.foreground],
    );
    const fg08 = useMemo(
      () => withOpacity(colors.foreground, 0.08),
      [colors.foreground],
    );
    const primary90 = useMemo(
      () => withOpacity(colors.primary, 0.9),
      [colors.primary],
    );

    useEffect(() => {
      appear.value = withTiming(1, {
        duration: 380,
        easing: Easing.out(Easing.cubic),
      });

      prog.value = withTiming(progress, {
        duration: 700,
        easing: Easing.out(Easing.cubic),
      });
    }, [progress, appear, prog]);

    const wrapAnim = useAnimatedStyle(() => ({
      opacity: appear.value,
      transform: [{ translateY: interpolate(appear.value, [0, 1], [10, 0]) }],
    }));

    const barAnim = useAnimatedStyle(() => {
      const pct = Math.max(0.06, prog.value); // minimum 6%
      return { width: `${pct * 100}%` };
    });

    const tilesRow1 = useMemo(() => badges.slice(0, 2), [badges]);
    const tilesRow2 = useMemo(() => badges.slice(2, 4), [badges]);

    return (
      <Animated.View style={[styles.container, wrapAnim]}>
        {/* glow */}
        <AppView
          pointerEvents="none"
          style={[
            styles.glow,
            { backgroundColor: glowBg, shadowColor: colors.primary },
          ]}
        />

        {/* Header */}
        <AppView style={styles.headerRow}>
          <AppView style={styles.headerLeft}>
            <AppView style={[styles.iconBubble, { backgroundColor: glowBg }]}>
              <Flame size={18} color={colors.primary} />
            </AppView>

            <AppView>
              <AppText
                variant="caption1"
                style={[styles.headerKicker, { color: fg45 }]}
              >
                STREAKS & BADGES
              </AppText>

              <AppText variant="title1" style={styles.headerTitle}>
                Keep it going
              </AppText>
            </AppView>
          </AppView>

          <AppView style={styles.headerRight}>
            <CheckCircle2 size={18} color={primary90} />
            <AppText
              variant="caption1"
              style={[styles.headerRightText, { color: fg55 }]}
            >
              Today active
            </AppText>
          </AppView>
        </AppView>

        {/* Big streak */}
        <AppView style={styles.bigRow}>
          <AppView style={styles.bigLeft}>
            <AppText
              variant="title3"
              style={[
                styles.bigNumber,
                {
                  color: colors.foreground,
                },
              ]}
            >
              {String(streakDays).padStart(2, '0')}
            </AppText>

            <AppText
              variant="caption1"
              style={[styles.bigLabel, { color: fg55 }]}
            >
              DAY STREAK
            </AppText>
          </AppView>

          <AppText
            variant="caption1"
            style={[styles.bestText, { color: fg45 }]}
          >
            Best: {bestStreakDays}d
          </AppText>
        </AppView>

        {/* Progress */}
        <AppView>
          <AppView style={styles.progressTop}>
            <AppText
              variant="caption1"
              style={[styles.progressLeft, { color: fg55 }]}
            >
              Next badge at {nextBadgeAt} days
            </AppText>

            <AppText variant="caption1" style={{ color: fg45 }}>
              {remain === 0 ? 'Unlocked 🎉' : `${remain} days left`}
            </AppText>
          </AppView>

          <AppView style={[styles.progressTrack, { backgroundColor: fg08 }]}>
            <Animated.View
              style={[
                styles.progressFill,
                barAnim,
                { backgroundColor: colors.primary },
              ]}
            />
          </AppView>
        </AppView>

        {/* Grid */}
        <AppView style={styles.grid}>
          {tilesRow1.map((b, i) => (
            <BadgeTile
              key={b.key}
              badge={b}
              index={i}
              primary={colors.primary}
              fg={colors.foreground}
            />
          ))}
        </AppView>

        <AppView style={styles.grid}>
          {tilesRow2.map((b, i) => (
            <BadgeTile
              key={b.key}
              badge={b}
              index={i + 2}
              primary={colors.primary}
              fg={colors.foreground}
            />
          ))}
        </AppView>
      </Animated.View>
    );
  },
);

/* ---------------- BadgeTile (extracted + memo) ---------------- */

type BadgeTileProps = {
  badge: TrackerBadge;
  index: number;
  primary: string;
  fg: string;
  fontsBold?: string;
};

const BadgeTile = memo(
  ({ badge, index, primary, fg, fontsBold }: BadgeTileProps) => {
    const pop = useSharedValue(0);

    const locked = !badge.unlocked;
    const Icon = badgeIcon(badge.key);

    const iconBg = useMemo(
      () => (locked ? withOpacity(fg, 0.06) : withOpacity(primary, 0.14)),
      [locked, fg, primary],
    );

    const lockColor = useMemo(() => withOpacity(fg, 0.35), [fg]);
    const labelMuted = useMemo(() => withOpacity(fg, 0.45), [fg]);
    const ruleMuted = useMemo(() => withOpacity(fg, 0.55), [fg]);

    useEffect(() => {
      pop.value = withDelay(
        120 + index * 90,
        withSpring(1, { damping: 16, stiffness: 220 }),
      );
    }, [index, pop]);

    const a = useAnimatedStyle(() => ({
      opacity: pop.value,
      transform: [{ scale: interpolate(pop.value, [0, 1], [0.96, 1]) }],
    }));

    return (
      <Animated.View style={[styles.tile, a]}>
        <Card>
          <AppView style={styles.tileTop}>
            <AppView style={[styles.tileIcon, { backgroundColor: iconBg }]}>
              {locked ? (
                <Lock size={18} color={lockColor} />
              ) : (
                <Icon size={18} color={primary} />
              )}
            </AppView>

            <AppText
              variant="caption2"
              style={[
                styles.tileStatus,
                { color: badge.unlocked ? primary : labelMuted },
              ]}
            >
              {badge.unlocked ? 'UNLOCKED' : 'LOCKED'}
            </AppText>
          </AppView>

          <AppText
            variant="subhead"
            style={[styles.tileTitle, { fontFamily: fontsBold }]}
            numberOfLines={1}
          >
            {badge.title}
          </AppText>

          <AppText
            variant="footnote"
            style={[styles.tileRule, { color: ruleMuted }]}
            numberOfLines={1}
          >
            {badge.rule}
          </AppText>
        </Card>
      </Animated.View>
    );
  },
);

/* ---------------- Styles (tokens) ---------------- */

const TILE_W = SCREEN_WIDTH / 2 - 27;

const styles = StyleSheet.create({
  container: {
    paddingTop: Spacing[1],
    paddingBottom: Spacing[1],
    gap: Spacing[6],
  },

  glow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: Radius.full,
    top: 0,
    right: -60,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
  },

  headerKicker: {
    letterSpacing: 1.2,
    fontWeight: '800',
  },

  headerTitle: {
    marginTop: Spacing[0.5],
  },

  headerRightText: {
    fontWeight: '700',
  },

  iconBubble: {
    height: 36,
    width: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bigRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  bigLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing[1],
  },

  bigNumber: {
    fontSize: 44,
    lineHeight: 48,
  },

  bigLabel: {
    letterSpacing: 0.8,
    fontWeight: '800',
  },

  bestText: {
    fontWeight: '700',
  },

  progressTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing[1],
  },

  progressLeft: {
    fontWeight: '700',
  },

  progressTrack: {
    height: 10,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
  },

  grid: {
    flexDirection: 'row',
    gap: Spacing[6],
  },

  tile: {
    width: TILE_W,
  },

  tileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  tileIcon: {
    height: 40,
    width: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tileStatus: {
    fontWeight: '800',
    letterSpacing: 0.6,
    fontSize: FontSize.xs,
  },

  tileTitle: {
    marginTop: Spacing[1],
  },

  tileRule: {
    marginTop: Spacing[0.5],
  },
});

/* ---------------- Skeleton Loader ---------------- */

export const TrackerStreaksSkeleton = memo(() => {
  const { colors } = useTheme();
  
  const glowBg = useMemo(
    () => withOpacity(colors.primary, 0.14),
    [colors.primary],
  );

  return (
    <AppView style={styles.container}>
      <AppView
        pointerEvents="none"
        style={[
          styles.glow,
          { backgroundColor: glowBg, shadowColor: colors.primary },
        ]}
      />

      {/* Header Skeleton */}
      <AppView style={styles.headerRow}>
        <AppView style={styles.headerLeft}>
          <Skeleton width={36} height={36} radius="full" />
          <AppView style={{ marginLeft: Spacing[1] }}>
            <Skeleton width={110} height={12} style={{ marginBottom: 4 }} />
            <Skeleton width={140} height={20} radius="sm" />
          </AppView>
        </AppView>
        <AppView style={styles.headerRight}>
          <Skeleton width={80} height={14} />
        </AppView>
      </AppView>

      {/* Big Row Skeleton */}
      <AppView style={styles.bigRow}>
        <AppView style={styles.bigLeft}>
          <Skeleton width={56} height={46} radius="md" />
          <Skeleton width={80} height={14} style={{ marginLeft: 4 }} />
        </AppView>
        <Skeleton width={70} height={14} />
      </AppView>

      {/* Progress Skeleton */}
      <AppView>
        <AppView style={styles.progressTop}>
          <Skeleton width={120} height={14} />
          <Skeleton width={80} height={14} />
        </AppView>
        <Skeleton width="100%" height={10} radius="full" />
      </AppView>

      {/* Grid Skeleton */}
      <AppView style={styles.grid}>
        <Animated.View style={styles.tile}>
          <Card>
            <AppView style={styles.tileTop}>
              <Skeleton width={40} height={40} radius="full" />
              <Skeleton width={60} height={12} />
            </AppView>
            <Skeleton width="70%" height={16} radius="sm" style={{ marginTop: Spacing[2] }} />
            <Skeleton width="50%" height={12} style={{ marginTop: Spacing[1] }} />
          </Card>
        </Animated.View>

        <Animated.View style={styles.tile}>
          <Card>
            <AppView style={styles.tileTop}>
              <Skeleton width={40} height={40} radius="full" />
              <Skeleton width={60} height={12} />
            </AppView>
            <Skeleton width="70%" height={16} radius="sm" style={{ marginTop: Spacing[2] }} />
            <Skeleton width="50%" height={12} style={{ marginTop: Spacing[1] }} />
          </Card>
        </Animated.View>
      </AppView>
      
      <AppView style={styles.grid}>
        <Animated.View style={styles.tile}>
          <Card>
            <AppView style={styles.tileTop}>
              <Skeleton width={40} height={40} radius="full" />
              <Skeleton width={60} height={12} />
            </AppView>
            <Skeleton width="70%" height={16} radius="sm" style={{ marginTop: Spacing[2] }} />
            <Skeleton width="50%" height={12} style={{ marginTop: Spacing[1] }} />
          </Card>
        </Animated.View>

        <Animated.View style={styles.tile}>
          <Card>
            <AppView style={styles.tileTop}>
              <Skeleton width={40} height={40} radius="full" />
              <Skeleton width={60} height={12} />
            </AppView>
            <Skeleton width="70%" height={16} radius="sm" style={{ marginTop: Spacing[2] }} />
            <Skeleton width="50%" height={12} style={{ marginTop: Spacing[1] }} />
          </Card>
        </Animated.View>
      </AppView>

    </AppView>
  );
});
