import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { ProgressChart } from 'react-native-chart-kit';
import { AppText, Card } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { ActivityRingsData } from '../types/analytics';

const screenWidth = Dimensions.get('window').width;

interface Props {
  rings: ActivityRingsData;
}

export const ActivityRings: React.FC<Props> = ({ rings }) => {
  const { colors, isDark } = useTheme();

  const data = {
    labels: ['Move', 'Exercise', 'Stand'], // Not directly shown but required for structure
    data: [
      rings.stepsGoalPercent,
      rings.caloriesGoalPercent,
      rings.timeGoalPercent,
    ],
    // Let's color code them (Red, Green, Blue) like standard activity rings
    colors: [
      `rgba(255, 59, 48, 1)`,  // Red - Move
      `rgba(52, 199, 89, 1)`,  // Green - Exercise
      `rgba(0, 122, 255, 1)`,  // Blue - Stand (mapped to Time)
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
          width={screenWidth - 32} // Match container padding
          height={200}
          strokeWidth={14}
          radius={28}
          chartConfig={{
            backgroundColor: 'transparent',
            backgroundGradientFrom: colors.background,
            backgroundGradientTo: colors.background,
            backgroundGradientFromOpacity: 0,
            backgroundGradientToOpacity: 0,
            color: (opacity = 1) => `rgba(${isDark ? '255, 255, 255' : '0, 0, 0'}, ${opacity * 0.1})`, // Ring track color
            labelColor: (opacity = 1) => colors.mutedForeground,
          }}
          hideLegend={false}
          withCustomBarColorFromData={true}
        />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    paddingTop: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
  },
  chartContainer: {
    alignItems: 'center',
  }
});
