// ─── FoodCard.tsx ─────────────────────────────────────────────────────────────
import React, { memo, useCallback } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Image,
} from 'react-native';
import { AppText, AppView } from '../../../../components';
import { Icon } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { DIET_TYPE_META } from '../../types/nutrition.types';
import type { FoodItem } from '../../types/nutrition.types';
import { makeStyles } from '../../../../hooks/makeStyles';

interface Props {
  item: FoodItem;
  onPress: (item: FoodItem) => void;
  onFavouriteToggle: (id: string) => void;
  isTogglingFav?: boolean;
  /** Number of servings already consumed today */
  intakeCount?: number;
  /** Total calories consumed today for this food */
  intakeCalories?: number;
}

const MacroBadge = memo(
  ({ label, value, color }: { label: string; value: number; color: string }) => {
    const styles = useStyles();
    return (
      <AppView style={[styles.macroBadge, { backgroundColor: withOpacity(color, 0.1) }]}>
        <AppText variant="caption2" weight="bold" color={color}>
          {Math.round(value)}g
        </AppText>
        <AppText variant="caption2" color={color} style={{ opacity: 0.75 }}>
          {label}
        </AppText>
      </AppView>
    );
  },
);

MacroBadge.displayName = 'MacroBadge';

interface HeaderProps {
  imageUrl?: string | null;
  emoji: string;
  bg: string;
  color: string;
}

const FoodImageHeader = memo(({ imageUrl, emoji, bg, color }: HeaderProps) => {
  const styles = useStyles();
  if (imageUrl) {
    return <Image source={{ uri: imageUrl }} style={styles.foodImage} resizeMode="cover" resizeMethod="resize" />;
  }
  return (
    <View style={[styles.foodImagePlaceholder, { backgroundColor: bg }]}>
      <AppText style={styles.foodEmoji}>{emoji}</AppText>
    </View>
  );
});

FoodImageHeader.displayName = 'FoodImageHeader';

const useStyles = makeStyles(({ colors, spacing, radius, fontSize }) => ({
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden' as const,
    flex: 1,
  },
  imageWrap: {
    position: 'relative' as const,
    width: '100%' as const,
    height: 108,
  },
  foodImage: {
    width: '100%' as const,
    height: '100%' as const,
  },
  foodImagePlaceholder: {
    width: '100%' as const,
    height: '100%' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  foodEmoji: {
    fontSize: 40,
  },
  colorStrip: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  favBtn: {
    position: 'absolute' as const,
    top: spacing[2],
    right: spacing[2],
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 10,
  },
  body: {
    padding: spacing[2.5],
    gap: spacing[1.25 as any] ?? 5,
  },
  dietBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[0.75 as any] ?? 3,
    alignSelf: 'flex-start' as const,
    paddingHorizontal: spacing[1.75 as any] ?? 7,
    paddingVertical: spacing[0.5],
    borderRadius: radius['2xl'],
  },
  dietEmoji: { fontSize: 10 },
  name: {
    lineHeight: 18,
    marginTop: 1,
  },
  serving: {
    opacity: 0.5,
    marginTop: -2,
  },
  calRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    marginTop: 1,
  },
  kcalLabel: {
    opacity: 0.6,
  },
  macros: {
    flexDirection: 'row' as const,
    gap: spacing[0.75 as any] ?? 3,
    marginTop: spacing[0.5],
  },
  macroBadge: {
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing[1.25 as any] ?? 5,
    paddingVertical: spacing[0.75 as any] ?? 3,
    borderRadius: radius.sm,
    gap: spacing[0.25 as any] ?? 1,
  },
  intakeBadge: {
    paddingHorizontal: spacing[1.5],
    paddingVertical: spacing[0.75 as any] ?? 3,
    borderRadius: radius.sm,
    alignSelf: 'flex-start' as const,
    marginTop: spacing[0.5],
  },
}));

export const FoodCard = memo(
  ({ item, onPress, onFavouriteToggle, isTogglingFav, intakeCount, intakeCalories }: Props) => {
    const { colors } = useTheme();
    const styles = useStyles();
    const dietMeta = DIET_TYPE_META[item.dietType];

    const handlePress = useCallback(() => onPress(item), [item, onPress]);
    const handleFav = useCallback(
      () => onFavouriteToggle(item._id),
      [item._id, onFavouriteToggle],
    );

    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={handlePress}
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.imageWrap}>
          <FoodImageHeader
            imageUrl={item.imageUrl}
            emoji={dietMeta.emoji}
            bg={dietMeta.bg}
            color={dietMeta.color}
          />

          <View style={[styles.colorStrip, { backgroundColor: dietMeta.color }]} />

          <TouchableOpacity
            onPress={handleFav}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[
              styles.favBtn,
              { backgroundColor: withOpacity(colors.background, 0.85) },
            ]}
            activeOpacity={0.7}
          >
            {isTogglingFav ? (
              <ActivityIndicator size={13} color="#E63946" />
            ) : (
              <Icon
                name="Heart"
                size={16}
                color={item.isFavourite ? '#E63946' : withOpacity(colors.foreground, 0.3)}
                filled={item.isFavourite}
              />
            )}
          </TouchableOpacity>
        </View>

        <AppView style={styles.body}>
          <AppView style={[styles.dietBadge, { backgroundColor: dietMeta.bg }]}>
            <AppText style={styles.dietEmoji}>{dietMeta.emoji}</AppText>
            <AppText variant="caption2" weight="semiBold" color={dietMeta.color}>
              {dietMeta.label}
            </AppText>
          </AppView>

          <AppText variant="subhead" weight="semiBold" numberOfLines={2} style={styles.name}>
            {item.name}
          </AppText>

          <AppText variant="caption2" style={styles.serving}>
            {item.servingSize} {item.servingUnit}
          </AppText>

          <AppView style={styles.calRow}>
            <AppText variant="title3" weight="bold" color={colors.primary}>
              {item.calories}
            </AppText>
            <AppText variant="caption2" style={styles.kcalLabel}>
              {' '}kcal
            </AppText>
          </AppView>

          <AppView style={styles.macros}>
            <MacroBadge label="P" value={item.protein} color="#1A6B4A" />
            <MacroBadge label="C" value={item.carbs} color="#2C5FA3" />
            <MacroBadge label="F" value={item.fat} color="#B04C78" />
          </AppView>

          {/* Today's intake badge */}
          {intakeCount != null && intakeCount > 0 && (
            <AppView style={[styles.intakeBadge, { backgroundColor: withOpacity(colors.primary, 0.08) }]}>
              <AppText variant="caption2" weight="semiBold" color={colors.primary}>
                ✓ {intakeCount} eaten · {intakeCalories ?? 0} kcal
              </AppText>
            </AppView>
          )}
        </AppView>
      </TouchableOpacity>
    );
  },
);

FoodCard.displayName = 'FoodCard';
