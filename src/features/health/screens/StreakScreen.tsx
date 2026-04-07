import React from 'react';
import { StyleSheet } from 'react-native';
import { AppText, Screen, AppView } from '../../../components';

type Props = {};

const StreakScreen = (props: Props) => {
  return (
    <Screen>
      <AppView center style={styles.container}>
        <AppText variant="headline">StreakScreen</AppText>
      </AppView>
    </Screen>
  );
};

export default StreakScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
});
