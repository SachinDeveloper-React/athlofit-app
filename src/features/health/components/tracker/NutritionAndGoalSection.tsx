import { StyleSheet, Text, View } from 'react-native';
import React, { memo } from 'react';
import { AppText, AppView } from '../../../../components';

type Props = {
  hidden?: boolean;
};

const NutritionAndGoalSection = memo(({ hidden }: Props) => {
  return (
    <AppView style={[styles.container, hidden && styles.hidden]}>
      <AppText>dcd</AppText>
    </AppView>
  );
});

export default NutritionAndGoalSection;

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  hidden: {
    display: 'none',
  },
});
