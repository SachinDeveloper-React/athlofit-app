// src/features/health/components/analytics/calendar/DayCell.tsx
import React, { memo } from 'react';
import { TouchableOpacity } from 'react-native';
import { AppText } from '../../../../../components';
import { intensityColor } from '../../../utils/analyticsFormatters';
import type { CalendarDay } from '../../../types/calendar.types';

interface Props {
  day: CalendarDay;
  cellSize: number;
  onPress: (d: CalendarDay) => void;
  primary: string;
  success: string;
  isDark: boolean;
  mutedForeground: string;
}

const DayCell = memo(({ day, cellSize, onPress, primary, success, isDark, mutedForeground }: Props) => {
  const dayNum = parseInt(day.date.split('-')[2], 10);
  const bg     = intensityColor(day.intensity, primary, success, isDark);
  const isGoal = day.intensity === 4;

  return (
    <TouchableOpacity
      onPress={() => onPress(day)}
      activeOpacity={0.75}
      style={{
        width: cellSize,
        height: cellSize,
        borderRadius: cellSize * (isGoal ? 0.3 : 0.25),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
      }}
    >
      <AppText
        style={{
          fontSize: cellSize < 36 ? 10 : 12,
          lineHeight: cellSize < 36 ? 13 : 15,
          color: day.intensity >= 3 ? '#fff' : mutedForeground,
          fontWeight: isGoal ? '700' : '400',
        }}
      >
        {dayNum}
      </AppText>
    </TouchableOpacity>
  );
});

DayCell.displayName = 'DayCell';
export default DayCell;
