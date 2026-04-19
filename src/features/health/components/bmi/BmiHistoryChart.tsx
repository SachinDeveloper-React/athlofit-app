import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LineChart } from 'react-native-chart-kit';

import { AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';

type Props = { data: number[] };

const BmiHistoryChart = memo(({ data }: Props) => {
  const { colors } = useTheme();
  if (data.length < 2) return null;

  return (
    <Animated.View entering={FadeInUp.delay(250).duration(400)}>
      <AppText variant="headline" style={styles.title}>BMI History</AppText>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <LineChart
          data={{ labels: data.map((_, i) => `${i + 1}`), datasets: [{ data, strokeWidth: 2 }] }}
          width={320}
          height={140}
          chartConfig={{
            backgroundColor: 'transparent',
            backgroundGradientFrom: colors.card,
            backgroundGradientTo: colors.card,
            decimalPlaces: 1,
            color: (opacity = 1) => withOpacity('#22C55E', opacity),
            labelColor: () => colors.mutedForeground,
            propsForDots: { r: '4', strokeWidth: '2', stroke: '#22C55E' },
          }}
          bezier
          withShadow={false}
          style={{ borderRadius: 12 }}
        />
      </View>
    </Animated.View>
  );
});

BmiHistoryChart.displayName = 'BmiHistoryChart';
export default BmiHistoryChart;

const styles = StyleSheet.create({
  title: { marginBottom: 10 },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    paddingVertical: 12,
  },
});
