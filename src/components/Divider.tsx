// src/components/Divider.tsx

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import AppText from './AppText';
import { useTheme } from '../hooks/useTheme';
import { Spacing } from '../constants/spacing';

interface DividerProps {
  label?: string;
  orientation?: 'horizontal' | 'vertical';
  my?: keyof typeof Spacing;
  mx?: keyof typeof Spacing;
  style?: StyleProp<ViewStyle>;
}

const Divider: React.FC<DividerProps> = ({
  label,
  orientation = 'horizontal',
  my = 4,
  mx,
  style,
}) => {
  const { colors } = useTheme();
  const lineColor = colors.border;

  if (orientation === 'vertical') {
    return (
      <View
        style={[
          {
            width: StyleSheet.hairlineWidth,
            alignSelf: 'stretch',
            backgroundColor: lineColor,
            marginHorizontal: mx ? Spacing[mx] : 0,
          },
          style,
        ]}
      />
    );
  }

  if (label) {
    return (
      <View style={[styles.row, { marginVertical: Spacing[my] }, style]}>
        <View style={[styles.line, { backgroundColor: lineColor }]} />
        <AppText
          variant="caption1"
          style={{
            marginHorizontal: Spacing[3],
            color: colors.mutedForeground,
          }}
        >
          {label}
        </AppText>
        <View style={[styles.line, { backgroundColor: lineColor }]} />
      </View>
    );
  }

  return (
    <View
      style={[
        {
          height: StyleSheet.hairlineWidth,
          backgroundColor: lineColor,
          marginVertical: Spacing[my],
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});

export default Divider;
