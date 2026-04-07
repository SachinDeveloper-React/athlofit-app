import React from 'react';
import { StyleSheet } from 'react-native';
import { AppText, Screen, AppView } from '../../../components';

type Props = {};

const ResetPasswordScreen = (props: Props) => {
  return (
    <Screen>
      <AppView center style={styles.container}>
        <AppText variant="headline">ResetPasswordScreen</AppText>
      </AppView>
    </Screen>
  );
};

export default ResetPasswordScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
});
