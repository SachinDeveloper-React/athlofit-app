// ─── FoodCard.tsx ─────────────────────────────────────────────────────────────
// Premium food item card with food image/emoji header, diet badge, macros,
// calorie count, and a favourite heart button.

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  item: FoodItem;
  onPress: (item: FoodItem) => void;
  onFavouriteToggle: (id: string) => void;
  /** true only while THIS item's mutation is in-flight */
  isTogglingFav?: boolean;
}

// ─── Macro Badge ──────────────────────────────────────────────────────────────

const MacroBadge = memo(
  ({
    label,
    value,
    color,
  }: {
    label: string;
    value: number;
    color: string;
  }) => (
    <AppView style={[styles.macroBadge, { backgroundColor: withOpacity(color, 0.1) }]}>
      <AppText variant="caption2" weight="bold" color={color}>
        {Math.round(value)}g
      </AppText>
      <AppText variant="caption2" color={color} style={{ opacity: 0.75 }}>
        {label}
      </AppText>
    </AppView>
  ),
);

MacroBadge.displayName = 'MacroBadge';

// ─── Food Image / Emoji Header ────────────────────────────────────────────────

interface HeaderProps {
  imageUrl?: string | null;
  emoji: string;
  bg: string;
  color: string;
}

const FoodImageHeader = memo(({ imageUrl, emoji, bg, color }: HeaderProps) => {
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={styles.foodImage}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={[styles.foodImagePlaceholder, { backgroundColor: bg }]}>
      <AppText style={styles.foodEmoji}>{emoji}</AppText>
    </View>
  );
});

FoodImageHeader.displayName = 'FoodImageHeader';

// ─── Main Component ───────────────────────────────────────────────────────────

export const FoodCard = memo(
  ({ item, onPress, onFavouriteToggle, isTogglingFav }: Props) => {
    const { colors } = useTheme();
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
        {/* ── Image / Emoji Header ── */}
        <View style={styles.imageWrap}>
          <FoodImageHeader
            imageUrl={item.imageUrl}
            emoji={dietMeta.emoji}
            bg={dietMeta.bg}
            color={dietMeta.color}
          />

          {/* Diet colour strip at bottom of image */}
          <View style={[styles.colorStrip, { backgroundColor: dietMeta.color }]} />

          {/* ── Favourite button (overlaid on image) ── */}
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

        {/* ── Body ── */}
        <AppView style={styles.body}>
          {/* Diet badge */}
          <AppView
            style={[styles.dietBadge, { backgroundColor: dietMeta.bg }]}
          >
            <AppText style={styles.dietEmoji}>{dietMeta.emoji}</AppText>
            <AppText variant="caption2" weight="semiBold" color={dietMeta.color}>
              {dietMeta.label}
            </AppText>
          </AppView>

          {/* Name */}
          <AppText
            variant="subhead"
            weight="semiBold"
            numberOfLines={2}
            style={styles.name}
          >
            {item.name}
          </AppText>

          {/* Serving */}
          <AppText variant="caption2" style={styles.serving}>
            {item.servingSize} {item.servingUnit}
          </AppText>

          {/* Calories */}
          <AppView style={styles.calRow}>
            <AppText variant="title3" weight="bold" color={colors.primary}>
              {item.calories}
            </AppText>
            <AppText variant="caption2" style={styles.kcalLabel}>
              {' '}kcal
            </AppText>
          </AppView>

          {/* Macros */}
          <AppView style={styles.macros}>
            <MacroBadge label="P" value={item.protein} color="#1A6B4A" />
            <MacroBadge label="C" value={item.carbs} color="#2C5FA3" />
            <MacroBadge label="F" value={item.fat} color="#B04C78" />
          </AppView>
        </AppView>
      </TouchableOpacity>
    );
  },
);

FoodCard.displayName = 'FoodCard';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    flex: 1,
  },
  // Image area
  imageWrap: {
    position: 'relative',
    width: '100%',
    height: 108,
  },
  foodImage: {
    width: '100%',
    height: '100%',
  },
  foodImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodEmoji: {
    fontSize: 40,
  },
  colorStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  favBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  body: {
    padding: 10,
    gap: 5,
  },
  dietBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
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
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 1,
  },
  kcalLabel: {
    opacity: 0.6,
  },
  macros: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 2,
  },
  macroBadge: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 1,
  },
});
