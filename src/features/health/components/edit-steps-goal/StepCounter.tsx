import React from 'react';
import { StyleSheet } from 'react-native';
import { AppText, AppView } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';

interface StepCounterProps {
  formattedSteps: string;
}

export function StepCounter({ formattedSteps }: StepCounterProps) {
  const { colors } = useTheme();
  return (
    <AppView style={styles.container} center>
      <AppText
        variant="largeTitle"
        style={[styles.number, { color: colors.foreground }]}
      >
        {formattedSteps}
      </AppText>
      <AppText variant="subhead" secondary style={styles.unit}>
        steps / day
      </AppText>
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
  },
  number: {
    letterSpacing: -2,
    lineHeight: 68,
  },
  unit: {
    marginTop: 4,
  },
});
