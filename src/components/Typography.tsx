import { StyleSheet, Text, View } from 'react-native';
import React, { memo } from 'react';

type Props = {};

const Typography = memo((props: Props) => {
  return (
    <View>
      <Text>Typography</Text>
    </View>
  );
});

export default Typography;

const styles = StyleSheet.create({});
