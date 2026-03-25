import { StyleSheet, Text, View } from 'react-native';
import React, { memo } from 'react';

type Props = {};

const Loader = memo((props: Props) => {
  return (
    <View>
      <Text>Loader</Text>
    </View>
  );
});

export default Loader;

const styles = StyleSheet.create({});
