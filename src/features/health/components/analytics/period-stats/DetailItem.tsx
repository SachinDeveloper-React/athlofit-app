// src/features/health/components/analytics/period-stats/DetailItem.tsx
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../../../components';
import type { ThemeColors } from '../../../../../constants/colors';

interface Props {
  label: string;
  value: string;
  valueColor?: string;
  colors: ThemeColors;
}

const DetailItem = memo(({ label, value, valueColor, colors }: Props) => (
  <View style={styles.item}>
    <AppText variant="caption1" style={{ color: colors.mutedForeground }}>
      {label}
    </AppText>
    <AppText
      variant="caption1"
      weight="semiBold"
      style={{ color: valueColor ?? colors.foreground }}
    >
      {value}
    </AppText>
  </View>
));

DetailItem.displayName = 'DetailItem';
export default DetailItem;

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
});
