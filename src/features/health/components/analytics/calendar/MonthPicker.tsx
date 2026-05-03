// src/features/health/components/analytics/calendar/MonthPicker.tsx
import React, { memo, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText } from '../../../../../components';
import { withOpacity } from '../../../../../utils/withOpacity';
import type { ThemeColors } from '../../../../../constants/colors';
import type { AvailableMonth } from '../../../types/calendar.types';

const CARD_PADDING = 16;

interface Props {
  months: AvailableMonth[];
  selectedYear: number;
  selectedMonth: number;
  onSelect: (year: number, month: number) => void;
  colors: ThemeColors;
}

const MonthPicker = memo(({ months, selectedYear, selectedMonth, onSelect, colors }: Props) => {
  const scrollRef = useRef<ScrollView>(null);

  const selectedIndex = useMemo(
    () => months.findIndex(m => m.year === selectedYear && m.month === selectedMonth),
    [months, selectedYear, selectedMonth],
  );

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      onLayout={() => {
        if (selectedIndex > 0) {
          scrollRef.current?.scrollTo({
            x: Math.max(0, selectedIndex * 128 - 40),
            animated: false,
          });
        }
      }}
    >
      {months.map(item => {
        const isSelected = item.year === selectedYear && item.month === selectedMonth;
        return (
          <TouchableOpacity
            key={`${item.year}-${item.month}`}
            onPress={() => onSelect(item.year, item.month)}
            activeOpacity={0.75}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected
                  ? colors.primary
                  : withOpacity(colors.primary, 0.08),
                borderColor: isSelected
                  ? colors.primary
                  : withOpacity(colors.primary, 0.15),
              },
            ]}
          >
            <AppText
              variant="caption1"
              weight={isSelected ? 'semiBold' : 'regular'}
              style={{ color: isSelected ? '#fff' : colors.mutedForeground }}
              numberOfLines={1}
            >
              {item.label}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

MonthPicker.displayName = 'MonthPicker';
export default MonthPicker;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: CARD_PADDING,
    paddingVertical: 2,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    minWidth: 120,
    alignItems: 'center',
  },
});
