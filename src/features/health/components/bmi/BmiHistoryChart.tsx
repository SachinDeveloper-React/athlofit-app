import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LineChart } from 'react-native-chart-kit';

import { AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { makeStyles } from '../../../../hooks/makeStyles';

type Props = { data: number[] };

const useStyles = makeStyles(({ colors, spacing, radius }) => ({
  title: { marginBottom: spacing[2.5] },
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden' as const,
    alignItems: 'center' as const,
    paddingVertical: spacing[3],
  },
}));

const BmiHistoryChart = memo(({ data }: Props) => {
  const { colors } = useTheme();
  const styles = useStyles();
  if (data.length < 2) return null;

  return (
    <Animated.View entering={FadeInUp.delay(250).duration(400)}>
      <AppText variant="headline" style={styles.title}>BMI History</AppText>
      <Animated.View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <LineChart
          data={{ labels: data.map((_, i) => `${i + 1}`), datasets: [{ data, strokeWidth: 2 }] }}
          width={320}
          height={160}
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
      </Animated.View>
    </Animated.View>
  );
});

BmiHistoryChart.displayName = 'BmiHistoryChart';
export default BmiHistoryChart;
