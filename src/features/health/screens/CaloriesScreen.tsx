import React from 'react';
import { StyleSheet } from 'react-native';
import { AppText, Screen, AppView } from '../../../components';

type Props = {};

const CaloriesScreen = (props: Props) => {
  return (
    <Screen>
      <AppView center style={styles.container}>
        <AppText variant="headline">CaloriesScreen</AppText>
      </AppView>
    </Screen>
  );
};

export default CaloriesScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
});
