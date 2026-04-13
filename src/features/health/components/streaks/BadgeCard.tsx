import React from 'react';
import { StyleSheet } from 'react-native';
import { AppText, AppView } from '../../../../components';
import type { TrackerBadge } from '../../types/gamification.type';

interface BadgeCardProps {
  badge: TrackerBadge;
  colors: any;
}

export const BadgeCard: React.FC<BadgeCardProps> = ({ badge, colors }) => {
  // All visual data (emoji, color, threshold) now comes directly from the API response.
  const badgeColor = badge.color ?? colors.primary;
  const emoji = badge.emoji ?? '🏅';

  return (
    <AppView
      style={[
        styles.badgeCard,
        {
          backgroundColor: badge.unlocked ? badgeColor + '18' : colors.card,
          borderColor: badge.unlocked ? badgeColor : colors.border,
        },
      ]}
    >
      <AppText style={{ fontSize: 32, marginBottom: 4 }}>{emoji}</AppText>
      <AppText
        variant="footnote"
        weight="semiBold"
        style={{
          color: badge.unlocked ? badgeColor : colors.foreground,
          textAlign: 'center',
        }}
      >
        {badge.title}
      </AppText>
      <AppText
        variant="caption2"
        style={{
          color: colors.foreground + '60',
          marginTop: 2,
          textAlign: 'center',
        }}
      >
        {badge.rule}
      </AppText>
      {!badge.unlocked && (
        <AppText
          variant="caption2"
          style={{
            marginTop: 6,
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 6,
            backgroundColor: colors.border,
            color: colors.foreground + '70',
            overflow: 'hidden',
          }}
        >
          🔒 {badge.threshold}d
        </AppText>
      )}
      {badge.unlocked && (
        <AppText
          variant="caption2"
          style={{
            marginTop: 6,
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 6,
            backgroundColor: badgeColor + '30',
            color: badgeColor,
            overflow: 'hidden',
          }}
        >
          ✓ EARNED
        </AppText>
      )}
    </AppView>
  );
};

const styles = StyleSheet.create({
  badgeCard: {
    width: '47%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 2,
  },
});
