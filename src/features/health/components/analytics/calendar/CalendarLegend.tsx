// src/features/health/components/analytics/calendar/CalendarLegend.tsx
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../../../components';
import { intensityColor } from '../../../utils/analyticsFormatters';

interface Props {
  primary: string;
  success: string;
  isDark: boolean;
}

const CalendarLegend = memo(({ primary, success, isDark }: Props) => (
  <View style={styles.legend}>
    <AppText variant="caption2" style={{ color: isDark ? '#666' : '#aaa', marginRight: 6 }}>
      Less
    </AppText>
    {([0, 1, 2, 3, 4] as const).map(i => (
      <View
        key={i}
        style={[styles.dot, { backgroundColor: intensityColor(i, primary, success, isDark) }]}
      />
    ))}
    <AppText variant="caption2" style={{ color: isDark ? '#666' : '#aaa', marginLeft: 6 }}>
      Goal ✓
    </AppText>
  </View>
));

CalendarLegend.displayName = 'CalendarLegend';
export default CalendarLegend;

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  dot: {
    width: 13,
    height: 13,
    borderRadius: 3,
    marginHorizontal: 2,
  },
});
