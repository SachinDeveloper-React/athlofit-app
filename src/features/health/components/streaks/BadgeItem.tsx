// src/features/health/components/streaks/BadgeItem.tsx
import React, { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { AppText, AppView } from '../../../../components';
import type { TrackerBadge } from '../../types/gamification.type';

interface BadgeItemProps {
  badge: TrackerBadge;
  streakDays: number;
  index: number;
  colors: any;
}

const CARD_WIDTH = 120;
const CARD_HEIGHT = 148;

export const BadgeItem = memo(
  ({ badge, streakDays, index, colors }: BadgeItemProps) => {
    const badgeColor = badge.color ?? colors.primary;
    const emoji = badge.emoji ?? '🏅';
    const isUnlocked = badge.unlocked;
    const progress = Math.min(1, streakDays / badge.threshold);

    // Track previous unlocked state to detect new-unlock transitions
    const prevUnlocked = useRef(isUnlocked);

    // ─── Entrance animation ───────────────────────────────────────────
    const entrance = useSharedValue(0);
    const entranceStyle = useAnimatedStyle(() => ({
      opacity: entrance.value,
      transform: [
        { scale: interpolate(entrance.value, [0, 1], [0.82, 1]) },
        { translateY: interpolate(entrance.value, [0, 1], [16, 0]) },
      ],
    }));

    useEffect(() => {
      entrance.value = withDelay(
        index * 60,
        withSpring(1, { damping: 18, stiffness: 200 }),
      );
    }, []);

    // ─── Glow pulse (unlocked only) ───────────────────────────────────
    const glow = useSharedValue(0);
    const glowStyle = useAnimatedStyle(() => ({
      opacity: interpolate(glow.value, [0, 1], [0.0, 0.55]),
      transform: [{ scale: interpolate(glow.value, [0, 1], [0.9, 1.12]) }],
    }));

    // ─── Burst animation (new unlock transition) ──────────────────────
    const burst = useSharedValue(1);
    const burstStyle = useAnimatedStyle(() => ({
      transform: [{ scale: burst.value }],
    }));

    useEffect(() => {
      if (isUnlocked) {
        // Soft breathing glow for all unlocked badges
        glow.value = withDelay(
          index * 80 + 300,
          withRepeat(
            withSequence(
              withTiming(1, {
                duration: 1600,
                easing: Easing.inOut(Easing.sin),
              }),
              withTiming(0, {
                duration: 1600,
                easing: Easing.inOut(Easing.sin),
              }),
            ),
            -1,
            false,
          ),
        );

        // Burst pop if this is a fresh unlock (was locked on last render)
        if (!prevUnlocked.current) {
          burst.value = withSequence(
            withTiming(1.18, {
              duration: 180,
              easing: Easing.out(Easing.back(2)),
            }),
            withSpring(1, { damping: 12, stiffness: 280 }),
          );
        }
      }
      prevUnlocked.current = isUnlocked;
    }, [isUnlocked]);

    return (
      <Animated.View style={[styles.wrapper, entranceStyle]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: isUnlocked ? badgeColor + '14' : colors.card,
              borderColor: isUnlocked ? badgeColor + '88' : colors.border,
              borderWidth: isUnlocked ? 1.5 : 1,
            },
          ]}
        >
          {/* Glow halo behind emoji (unlocked only) */}
          {isUnlocked && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.glowHalo,
                { backgroundColor: badgeColor },
                glowStyle,
              ]}
            />
          )}

          {/* Emoji */}
          <Animated.View style={burstStyle}>
            <AppText style={[styles.emoji, !isUnlocked && styles.emojiLocked]}>
              {emoji}
            </AppText>
          </Animated.View>

          {/* Title */}
          <AppText
            variant="footnote"
            weight="semiBold"
            numberOfLines={1}
            style={[
              styles.title,
              { color: isUnlocked ? badgeColor : colors.foreground + '80' },
            ]}
          >
            {badge.title}
          </AppText>

          {/* Threshold label */}
          <AppText
            variant="caption2"
            style={[
              styles.threshold,
              {
                color: isUnlocked
                  ? badgeColor + 'cc'
                  : colors.foreground + '50',
              },
            ]}
          >
            {badge.threshold}d
          </AppText>

          {/* Status pill */}
          {isUnlocked ? (
            <View style={[styles.pill, { backgroundColor: badgeColor + '28' }]}>
              <AppText
                variant="caption2"
                style={{ color: badgeColor, fontWeight: '700', fontSize: 10 }}
              >
                ✓ EARNED
              </AppText>
            </View>
          ) : (
            <View style={styles.lockedSection}>
              {/* Progress bar */}
              <View
                style={[
                  styles.progressTrack,
                  { backgroundColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.round(progress * 100)}%`,
                      backgroundColor: badgeColor + '90',
                    },
                  ]}
                />
              </View>
              <AppText
                variant="caption2"
                style={{
                  color: colors.foreground + '45',
                  fontSize: 9,
                  marginTop: 3,
                }}
              >
                {streakDays}/{badge.threshold}d
              </AppText>
            </View>
          )}
        </View>
      </Animated.View>
    );
  },
);

BadgeItem.displayName = 'BadgeItem';

const styles = StyleSheet.create({
  wrapper: {
    width: CARD_WIDTH,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 14,
    gap: 4,
    overflow: 'hidden',
  },
  glowHalo: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    top: 12,
  },
  emoji: {
    fontSize: 36,
    lineHeight: 44,
  },
  emojiLocked: {
    opacity: 0.28,
  },
  title: {
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  threshold: {
    textAlign: 'center',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  pill: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  lockedSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  progressTrack: {
    width: '80%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    minWidth: 4,
  },
});
