import React from 'react';
import { StyleSheet } from 'react-native';
import { AppText, Screen, AppView } from '../../../components';

type Props = {};

const CheckoutScreen = (props: Props) => {
  return (
    <Screen>
      <AppView center style={styles.container}>
        <AppText variant="headline">CheckoutScreen</AppText>
      </AppView>
    </Screen>
  );
};

export default CheckoutScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
});
