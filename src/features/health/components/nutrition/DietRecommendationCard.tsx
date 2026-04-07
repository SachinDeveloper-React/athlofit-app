// ─── DietRecommendationCard.tsx ───────────────────────────────────────────────
// A vibrant banner card showing a goal-driven diet recommendation.

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, AppView } from '../../../../components';
import type { DietaryGoal } from '../../types/nutrition.types';
import { DIET_RECOMMENDATIONS } from '../../types/nutrition.types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  goal: DietaryGoal;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DietRecommendationCard = memo(({ goal }: Props) => {
  const rec = DIET_RECOMMENDATIONS[goal];

  return (
    <View style={[styles.card, { backgroundColor: rec.bg }]}>
      {/* Header row */}
      <AppView style={styles.header}>
        <AppText style={styles.emoji}>{rec.emoji}</AppText>
        <AppView style={styles.titleWrap}>
          <AppText
            variant="overline"
            color={rec.color}
            style={styles.overline}
          >
            Diet Recommendation
          </AppText>
          <AppText
            variant="headline"
            color={rec.color}
            weight="bold"
          >
            {rec.title}
          </AppText>
        </AppView>
      </AppView>

      {/* Body */}
      <AppText variant="subhead" color={rec.color} style={styles.body}>
        {rec.body}
      </AppText>

      {/* Decorative accent */}
      <View
        style={[styles.accent, { backgroundColor: rec.color, opacity: 0.12 }]}
      />
    </View>
  );
});

DietRecommendationCard.displayName = 'DietRecommendationCard';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 18,
    overflow: 'hidden',
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  emoji: { fontSize: 36, lineHeight: 42 },
  titleWrap: { flex: 1, gap: 2 },
  overline: { marginBottom: 2, letterSpacing: 1 },
  body: { lineHeight: 22, opacity: 0.85 },
  accent: {
    position: 'absolute',
    right: -20,
    bottom: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
  },
});
