// src/components/Avatar.tsx

import React from 'react';
import { View, Image, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import AppText from './AppText';
import { useTheme } from '../hooks/useTheme';
import { Radius } from '../constants/spacing';
import { FontWeight } from '../constants/typography';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
type AvatarShape = 'circle' | 'rounded';

interface AvatarProps {
  uri?: string;
  name?: string;
  size?: AvatarSize;
  shape?: AvatarShape;
  bg?: string;
  bordered?: boolean;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
}

const sizeMap: Record<AvatarSize, { box: number; font: number }> = {
  xs: { box: 24, font: 10 },
  sm: { box: 32, font: 12 },
  md: { box: 44, font: 16 },
  lg: { box: 56, font: 20 },
  xl: { box: 72, font: 26 },
  '2xl': { box: 96, font: 34 },
};

// Deterministic color from name string
const AVATAR_COLORS = [
  '#0099FF',
  '#6B5CFF',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#EC4899',
  '#8B5CF6',
  '#06B6D4',
];
function colorFromName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

const Avatar: React.FC<AvatarProps> = ({
  uri,
  name,
  size = 'md',
  shape = 'circle',
  bg,
  bordered,
  borderColor,
  style,
}) => {
  const { colors } = useTheme();
  const { box, font } = sizeMap[size];
  const radius = shape === 'circle' ? box / 2 : Radius.xl;
  const bgColor = bg ?? (name ? colorFromName(name) : colors.muted);

  const containerStyle: StyleProp<ViewStyle> = [
    styles.base,
    { width: box, height: box, borderRadius: radius, backgroundColor: bgColor },
    bordered && {
      borderWidth: 2.5,
      borderColor: borderColor ?? colors.background,
    },
    style,
  ];

  if (uri) {
    return <Image source={{ uri }} style={containerStyle as any} />;
  }

  return (
    <View style={containerStyle}>
      <AppText
        style={{
          fontSize: font,
          fontWeight: FontWeight.semiBold,
          color: '#FFFFFF',
        }}
      >
        {name ? initials(name) : '?'}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

export default Avatar;
