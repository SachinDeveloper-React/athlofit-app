import React, { memo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { METRIC_CONFIG, MetricKey } from './analyticsConstants';
import TrendBadge from './TrendBadge';

type Props = {
  metricKey: MetricKey;
  value: string | number;
  trend: number;
  isSelected: boolean;
  onPress: () => void;
  index: number;
};

const MetricCard = memo(({ metricKey, value, trend, isSelected, onPress, index }: Props) => {
  const { colors, isDark } = useTheme();
  const cfg = METRIC_CONFIG[metricKey];
  const Icon = cfg.icon;
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(0.95, { damping: 15 }, () => {
      scale.value = withSpring(1);
    });
    onPress();
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(400)}
      style={[animStyle, styles.wrap]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        style={[
          styles.card,
          {
            backgroundColor: isSelected ? (isDark ? cfg.darkBg : cfg.bg) : colors.card,
            borderColor: isSelected ? cfg.color : colors.border,
            borderWidth: isSelected ? 1.5 : StyleSheet.hairlineWidth,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: withOpacity(cfg.color, 0.15) }]}>
          <Icon size={18} color={cfg.color} />
        </View>
        <AppText variant="caption1" style={{ color: colors.mutedForeground, marginTop: 8 }}>
          {cfg.label}
        </AppText>
        <View style={styles.valueRow}>
          <AppText variant="title3" weight="bold" style={{ color: colors.foreground }}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </AppText>
          <AppText variant="caption2" style={{ color: colors.mutedForeground, marginLeft: 3 }}>
            {cfg.unit}
          </AppText>
        </View>
        <TrendBadge trend={trend} />
      </TouchableOpacity>
    </Animated.View>
  );
});

MetricCard.displayName = 'MetricCard';
export default MetricCard;

const styles = StyleSheet.create({
  wrap: { width: '48%' },
  card: { borderRadius: 16, padding: 14, gap: 4 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginTop: 2,
  },
});
