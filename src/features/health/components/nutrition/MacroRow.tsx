import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, AppView } from '../../../../components';
import { withOpacity } from '../../../../utils/withOpacity';

type Props = {
  label: string;
  value: number | undefined;
  unit: string;
  color: string;
  percent?: number;
};

const MacroRow = memo(({ label, value, unit, color, percent }: Props) => {
  if (value === undefined) return null;
  return (
    <AppView style={styles.row}>
      <AppView style={[styles.dot, { backgroundColor: color }]} />
      <AppText variant="subhead" style={styles.label}>{label}</AppText>
      <AppView style={styles.barWrap}>
        <View style={[styles.bar, { backgroundColor: withOpacity(color, 0.15) }]}>
          <View style={[styles.fill, { width: `${Math.min(100, percent ?? 0)}%` as any, backgroundColor: color }]} />
        </View>
      </AppView>
      <AppText variant="subhead" weight="semiBold">
        {value}<AppText variant="caption1">{unit}</AppText>
      </AppText>
    </AppView>
  );
});

MacroRow.displayName = 'MacroRow';
export default MacroRow;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { width: 110 },
  barWrap: { flex: 1 },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
