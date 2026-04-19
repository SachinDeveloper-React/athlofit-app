import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { AppText, AppView } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { CATEGORY_META, BmiCategory } from './bmiHelpers';

type BmiRecord = {
  _id: string;
  bmi: number;
  weight: number;
  height: number;
  category: string;
  date: string;
};

type Props = { history: BmiRecord[] };

const BmiHistoryList = memo(({ history }: Props) => {
  const { colors } = useTheme();
  if (history.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(300).duration(400)}>
      <AppText variant="headline" style={styles.title}>Past Readings</AppText>
      {history.slice(0, 5).map(record => {
        const m = CATEGORY_META[record.category as BmiCategory];
        return (
          <View
            key={record._id}
            style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <AppView style={[styles.dot, { backgroundColor: m.color }]} />
            <AppView style={{ flex: 1 }}>
              <AppText variant="subhead" weight="semiBold">BMI {record.bmi}</AppText>
              <AppText variant="caption2" style={{ opacity: 0.55, marginTop: 1 }}>
                {record.weight} kg · {(record.height * 100).toFixed(0)} cm
              </AppText>
            </AppView>
            <View style={[styles.badge, { backgroundColor: withOpacity(m.color, 0.12) }]}>
              <AppText variant="caption2" weight="semiBold" color={m.color}>{m.label}</AppText>
            </View>
            <AppText variant="caption2" style={{ marginLeft: 8, opacity: 0.4 }}>{record.date}</AppText>
          </View>
        );
      })}
    </Animated.View>
  );
});

BmiHistoryList.displayName = 'BmiHistoryList';
export default BmiHistoryList;

const styles = StyleSheet.create({
  title: { marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 8,
    gap: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
});
