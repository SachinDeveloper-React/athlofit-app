import React from 'react';
import { View, Dimensions } from 'react-native';
import { ProgressChart } from 'react-native-chart-kit';
import { AppText, Card } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { ActivityRingsData } from '../types/analytics';
import { makeStyles } from '../../../hooks/makeStyles';

const screenWidth = Dimensions.get('window').width;

interface Props {
  rings: ActivityRingsData;
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  container: {
    marginBottom: spacing[6],
    paddingTop: spacing[2],
  },
  header: {
    alignItems: 'center' as const,
    marginBottom: spacing[2],
  },
  chartContainer: {
    alignItems: 'center' as const,
  },
}));

export const ActivityRings: React.FC<Props> = ({ rings }) => {
  const { colors, isDark } = useTheme();
  const styles = useStyles();

  const data = {
    labels: ['Move', 'Exercise', 'Stand'],
    data: [
      rings.stepsGoalPercent,
      rings.caloriesGoalPercent,
      rings.timeGoalPercent,
    ],
    colors: [
      `rgba(255, 59, 48, 1)`,
      `rgba(52, 199, 89, 1)`,
      `rgba(0, 122, 255, 1)`,
    ]
  };

  return (
    <Card variant="ghost" style={styles.container}>
      <View style={styles.header}>
        <AppText variant="title2">Daily Progress</AppText>
        <AppText variant="footnote" secondary>You're closing your rings!</AppText>
      </View>
      <View style={styles.chartContainer}>
        <ProgressChart
          data={data}
          width={screenWidth - 32}
          height={200}
          strokeWidth={14}
          radius={28}
          chartConfig={{
            backgroundColor: 'transparent',
            backgroundGradientFrom: colors.background,
            backgroundGradientTo: colors.background,
            backgroundGradientFromOpacity: 0,
            backgroundGradientToOpacity: 0,
            color: (opacity = 1) => `rgba(${isDark ? '255, 255, 255' : '0, 0, 0'}, ${opacity * 0.1})`,
            labelColor: (opacity = 1) => colors.mutedForeground,
          }}
          hideLegend={false}
          withCustomBarColorFromData={true}
        />
      </View>
    </Card>
  );
};
