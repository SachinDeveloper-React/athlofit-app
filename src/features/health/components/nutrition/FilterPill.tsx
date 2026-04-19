import React, { memo } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';

type Props = {
  label: string;
  emoji: string;
  isActive: boolean;
  color: string;
  onPress: () => void;
};

const FilterPill = memo(({ label, emoji, isActive, color, onPress }: Props) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.pill,
        isActive
          ? { backgroundColor: color, borderColor: color }
          : { borderColor: withOpacity(colors.border, 0.8), backgroundColor: colors.card },
      ]}
    >
      {!!emoji && <AppText style={styles.emoji}>{emoji}</AppText>}
      <AppText variant="caption1" weight={isActive ? 'semiBold' : 'regular'} color={isActive ? '#fff' : undefined}>
        {label}
      </AppText>
    </TouchableOpacity>
  );
});

FilterPill.displayName = 'FilterPill';
export default FilterPill;

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    alignSelf: 'center',
    minHeight: 36,
  },
  emoji: { fontSize: 13 },
});
