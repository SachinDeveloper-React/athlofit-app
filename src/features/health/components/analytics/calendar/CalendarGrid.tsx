// src/features/health/components/analytics/calendar/CalendarGrid.tsx
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../../../components';
import DayCell from './DayCell';
import EmptyCell from './EmptyCell';
import type { CalendarDay } from '../../../types/calendar.types';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CELL_GAP   = 4;

interface Props {
  weeks: (CalendarDay | null)[][];
  cellSize: number;
  onDayPress: (day: CalendarDay) => void;
  primary: string;
  success: string;
  isDark: boolean;
  mutedForeground: string;
}

const CalendarGrid = memo(({
  weeks,
  cellSize,
  onDayPress,
  primary,
  success,
  isDark,
  mutedForeground,
}: Props) => (
  <View>
    {/* Day-of-week header */}
    <View style={[styles.row, { marginBottom: 6 }]}>
      {DAY_LABELS.map(d => (
        <View key={d} style={{ width: cellSize, alignItems: 'center' }}>
          <AppText variant="caption2" style={{ color: mutedForeground, fontSize: 10 }}>
            {d}
          </AppText>
        </View>
      ))}
    </View>

    {/* Week rows */}
    {weeks.map((week, wi) => (
      <View key={wi} style={[styles.row, { marginBottom: CELL_GAP }]}>
        {Array(7).fill(null).map((_, di) => {
          const day = week[di] ?? null;
          return day ? (
            <DayCell
              key={day.date}
              day={day}
              cellSize={cellSize}
              onPress={onDayPress}
              primary={primary}
              success={success}
              isDark={isDark}
              mutedForeground={mutedForeground}
            />
          ) : (
            <EmptyCell key={`e-${wi}-${di}`} cellSize={cellSize} />
          );
        })}
      </View>
    ))}
  </View>
));

CalendarGrid.displayName = 'CalendarGrid';
export default CalendarGrid;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
