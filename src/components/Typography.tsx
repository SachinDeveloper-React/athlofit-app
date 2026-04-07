import { StyleSheet } from 'react-native';
import React, { memo } from 'react';
import AppView from './AppView';
import AppText from './AppText';

type Props = {};

const Typography = memo((props: Props) => {
  return (
    <AppView>
      <AppText>Typography</AppText>
    </AppView>
  );
});

export default Typography;

const styles = StyleSheet.create({});
