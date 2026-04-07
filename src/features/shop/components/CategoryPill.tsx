// src/features/shop/components/CategoryPill.tsx
import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTheme } from '../../../hooks/useTheme';
import AppText from '../../../components/AppText';
import { Icon } from '../../../components/Icon';
import { withOpacity } from '../../../utils/withOpacity';
import type { Category } from '../types/shop.types';

interface Props {
  category: Category;
  isSelected: boolean;
  onPress: (slug: string) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CategoryPill = memo(({ category, isSelected, onPress }: Props) => {
  const { colors, spacing, radius } = useTheme();

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isSelected ? 1 : 0.97) }],
  }));

  const bgColor = isSelected ? category.color : withOpacity(category.color, 0.1);
  const textColor = isSelected ? '#FFFFFF' : category.color;

  return (
    <AnimatedPressable
      style={[animStyle, styles.pill, { backgroundColor: bgColor, borderRadius: radius.full, marginRight: spacing[2] }]}
      onPress={() => onPress(category.slug)}
    >
      <Icon name={category.icon as any} size={14} color={textColor} />
      <AppText
        variant="caption1"
        weight="semiBold"
        color={textColor}
        style={{ marginLeft: spacing[1] }}
      >
        {category.name}
      </AppText>
    </AnimatedPressable>
  );
});

CategoryPill.displayName = 'CategoryPill';
export default CategoryPill;

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});
