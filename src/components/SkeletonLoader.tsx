// src/components/SkeletonLoader.tsx

import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Easing,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius } from '../constants/spacing';

// ─── Primitive bone ───────────────────────────────────────────────────────────

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: keyof typeof Radius;
  style?: StyleProp<ViewStyle>;
}

const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  radius = 'md',
  style,
}) => {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: Radius[radius],
          backgroundColor: colors.muted,
          opacity,
        },
        style,
      ]}
    />
  );
};

// ─── Pre-built layouts ────────────────────────────────────────────────────────

export const MetricCardSkeleton: React.FC = () => (
  <View style={sk.card}>
    <Skeleton width={40} height={40} radius="xl" style={sk.mb3} />
    <Skeleton width="55%" height={12} style={sk.mb2} />
    <Skeleton width="35%" height={28} radius="lg" />
  </View>
);

export const ListItemSkeleton: React.FC = () => (
  <View style={sk.row}>
    <Skeleton width={44} height={44} radius="full" />
    <View style={sk.rowText}>
      <Skeleton width="65%" height={14} style={sk.mb2} />
      <Skeleton width="40%" height={11} />
    </View>
  </View>
);

export const ProfileSkeleton: React.FC = () => (
  <View style={sk.profileWrap}>
    <Skeleton width={80} height={80} radius="full" style={sk.mb3} />
    <Skeleton width="45%" height={20} radius="lg" style={sk.mb2} />
    <Skeleton width="30%" height={13} />
  </View>
);

export const ChartSkeleton: React.FC = () => (
  <View style={sk.card}>
    <Skeleton width="50%" height={14} style={sk.mb3} />
    <Skeleton width="100%" height={140} radius="lg" />
  </View>
);

const sk = StyleSheet.create({
  card: { padding: Spacing[5], backgroundColor: 'transparent' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing[4],
    gap: Spacing[3],
  },
  rowText: { flex: 1 },
  profileWrap: { alignItems: 'center', padding: Spacing[6] },
  mb2: { marginBottom: Spacing[1] },
  mb3: { marginBottom: Spacing[3] },
});

export { Skeleton };
export default Skeleton;
