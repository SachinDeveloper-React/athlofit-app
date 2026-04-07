import React from 'react';
import { StyleSheet } from 'react-native';
import { AppText, Screen, AppView } from '../../../components';

type Props = {};

const StepsScreen = (props: Props) => {
  return (
    <Screen>
      <AppView center style={styles.container}>
        <AppText variant="headline">StepsScreen</AppText>
      </AppView>
    </Screen>
  );
};

export default StepsScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
});
