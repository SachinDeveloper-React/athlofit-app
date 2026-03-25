import React, { useMemo, useEffect, memo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { AppText, AppView, Icon } from '../../../../components';
import { FontSize } from '../../../../constants/typography';
import { Radius, Spacing } from '../../../../constants/spacing';
import {
  calcCoinsFromSteps,
  getTrackerMessage,
} from '../../utils/streakCalculator';

type Props = {
  steps: number;
  goalSteps: number;
  streakDays: number;
  onComputed?: (data: {
    coinsToday: number;
    streakWillContinue: boolean;
  }) => void;
};

export const TrackerMotivation = memo(
  ({ steps, goalSteps, streakDays, onComputed }: Props) => {
    const { colors } = useTheme();

    /* ---------- DERIVED ---------- */
    const coinsToday = useMemo(() => calcCoinsFromSteps(steps), [steps]);
    const streakWillContinue = goalSteps > 0 && steps >= goalSteps;

    const msg = useMemo(
      () =>
        getTrackerMessage({
          steps,
          goalSteps,
          streakDays,
          coinsToday,
        }),
      [steps, goalSteps, streakDays, coinsToday],
    );

    /* ---------- COLORS ---------- */
    const primaryGlow = useMemo(
      () => withOpacity(colors.primary, 0.18),
      [colors.primary],
    );

    const primaryGlow2 = useMemo(
      () => withOpacity(colors.primary, 0.1),
      [colors.primary],
    );

    const textMuted = useMemo(
      () => withOpacity(colors.foreground, 0.62),
      [colors.foreground],
    );

    const textHint = useMemo(
      () => withOpacity(colors.foreground, 0.42),
      [colors.foreground],
    );

    const watermark = useMemo(
      () => withOpacity(colors.primary, 0.08),
      [colors.primary],
    );

    /* ---------- EFFECT ---------- */
    useEffect(() => {
      onComputed?.({ coinsToday, streakWillContinue });
    }, [coinsToday, streakWillContinue, onComputed]);

    return (
      <AppView style={styles.container}>
        {/* Glow */}
        <AppView
          pointerEvents="none"
          style={[
            styles.glow,
            { backgroundColor: primaryGlow, shadowColor: colors.primary },
          ]}
        />
        <AppView
          pointerEvents="none"
          style={[
            styles.glow2,
            {
              backgroundColor: primaryGlow2,
              shadowColor: colors.primary,
            },
          ]}
        />

        {/* Watermark */}
        <Icon name="Flame" size={140} color={watermark} style={styles.bgIcon} />

        {/* Title */}
        <AppText
          variant="title1"
          style={[
            styles.title,
            {
              color: colors.foreground,
            },
          ]}
        >
          {msg.title}
        </AppText>

        {/* Subtitle */}
        <AppText variant="body" style={[styles.subtitle, { color: textMuted }]}>
          {msg.subtitle}
        </AppText>

        {/* Hint */}
        <AppText variant="caption1" style={[styles.hint, { color: textHint }]}>
          {msg.hint}
        </AppText>
      </AppView>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing[6],
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    textAlign: 'center',
    lineHeight: 42,
    letterSpacing: 0.6,
  },

  subtitle: {
    marginTop: Spacing[1],
    textAlign: 'center',
    maxWidth: '86%',
    fontSize: FontSize.md,
  },

  hint: {
    marginTop: Spacing[4],
    textAlign: 'center',
    letterSpacing: 0.6,
    fontSize: FontSize.sm,
  },

  bgIcon: {
    position: 'absolute',
    top: -22,
    right: -18,
  },

  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: Radius.full,
    top: -120,
    left: -120,
  },

  glow2: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: Radius.full,
    bottom: -120,
    right: -120,
  },
});
