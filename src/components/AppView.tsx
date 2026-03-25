// src/components/AppView.tsx

import React from 'react';
import {
  View,
  ViewStyle,
  StyleProp,
  ViewProps as RNViewProps,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius } from '../constants/spacing';

interface AppViewProps extends RNViewProps {
  flex?: number;
  row?: boolean;
  center?: boolean;
  centerX?: boolean;
  centerY?: boolean;
  spaceBetween?: boolean;
  spaceAround?: boolean;
  wrap?: boolean;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  gap?: keyof typeof Spacing;
  p?: keyof typeof Spacing;
  px?: keyof typeof Spacing;
  py?: keyof typeof Spacing;
  pt?: keyof typeof Spacing;
  pb?: keyof typeof Spacing;
  pl?: keyof typeof Spacing;
  pr?: keyof typeof Spacing;
  m?: keyof typeof Spacing;
  mx?: keyof typeof Spacing;
  my?: keyof typeof Spacing;
  mt?: keyof typeof Spacing;
  mb?: keyof typeof Spacing;
  bg?: string;
  useCard?: boolean; // uses theme card color
  radius?: keyof typeof Radius;
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const AppView: React.FC<AppViewProps> = ({
  flex,
  row,
  center,
  centerX,
  centerY,
  spaceBetween,
  spaceAround,
  wrap,
  align,
  justify,
  gap,
  p,
  px,
  py,
  pt,
  pb,
  pl,
  pr,
  m,
  mx,
  my,
  mt,
  mb,
  bg,
  useCard,
  radius,
  bordered,
  style,
  children,
  ...rest
}) => {
  const { colors } = useTheme();

  const computed: ViewStyle = {
    ...(flex !== undefined && { flex }),
    flexDirection: row ? 'row' : 'column',
    ...(center && { alignItems: 'center', justifyContent: 'center' }),
    ...(centerX && { alignItems: 'center' }),
    ...(centerY && { justifyContent: 'center' }),
    ...(spaceBetween && { justifyContent: 'space-between' }),
    ...(spaceAround && { justifyContent: 'space-around' }),
    ...(wrap && { flexWrap: 'wrap' }),
    ...(align && { alignItems: align }),
    ...(justify && { justifyContent: justify }),
    ...(gap !== undefined && { gap: Spacing[gap] }),
    ...(p !== undefined && { padding: Spacing[p] }),
    ...(px !== undefined && { paddingHorizontal: Spacing[px] }),
    ...(py !== undefined && { paddingVertical: Spacing[py] }),
    ...(pt !== undefined && { paddingTop: Spacing[pt] }),
    ...(pb !== undefined && { paddingBottom: Spacing[pb] }),
    ...(pl !== undefined && { paddingLeft: Spacing[pl] }),
    ...(pr !== undefined && { paddingRight: Spacing[pr] }),
    ...(m !== undefined && { margin: Spacing[m] }),
    ...(mx !== undefined && { marginHorizontal: Spacing[mx] }),
    ...(my !== undefined && { marginVertical: Spacing[my] }),
    ...(mt !== undefined && { marginTop: Spacing[mt] }),
    ...(mb !== undefined && { marginBottom: Spacing[mb] }),
    ...(useCard && { backgroundColor: colors.card }),
    ...(bg && { backgroundColor: bg }),
    ...(radius && { borderRadius: Radius[radius] }),
    ...(bordered && { borderWidth: 1, borderColor: colors.border }),
  };

  return (
    <View style={[computed, style]} {...rest}>
      {children}
    </View>
  );
};

export default AppView;
