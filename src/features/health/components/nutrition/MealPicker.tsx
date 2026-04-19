import React, { memo } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { AppText, AppView } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { MEAL_META } from '../../types/nutrition.types';
import type { MealType } from '../../types/nutrition.types';

type Props = {
  selected: MealType;
  onSelect: (mt: MealType) => void;
};

const MealPicker = memo(({ selected, onSelect }: Props) => {
  const { colors } = useTheme();
  return (
    <AppView style={styles.row}>
      {MEAL_META.map(m => {
        const isActive = selected === m.type;
        return (
          <TouchableOpacity
            key={m.type}
            onPress={() => onSelect(m.type)}
            activeOpacity={0.75}
            style={[
              styles.chip,
              isActive
                ? { backgroundColor: m.color, borderColor: m.color }
                : { borderColor: withOpacity(colors.border, 0.8), backgroundColor: colors.card },
            ]}
          >
            <AppText style={{ fontSize: 14 }}>{m.emoji}</AppText>
            <AppText variant="caption1" weight={isActive ? 'semiBold' : 'regular'} color={isActive ? '#fff' : undefined}>
              {m.label}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </AppView>
  );
});

MealPicker.displayName = 'MealPicker';
export default MealPicker;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
});
