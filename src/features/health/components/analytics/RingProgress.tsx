import React, { memo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { RING_SIZE, RING_STROKE, RING_R, RING_CIRC } from './analyticsConstants';

type Props = {
  percent: number;
  color: string;
  label: string;
  icon: any;
  value: string;
};

const RingProgress = memo(({ percent, color, label, icon: Icon, value }: Props) => {
  const { colors, isDark } = useTheme();
  const dash = RING_CIRC * Math.min(1, Math.max(0, percent));
  const gap = RING_CIRC - dash;

  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <G
          transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`}
        >
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            stroke={isDark ? '#2B2F3A' : '#E5E7EB'}
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            stroke={color}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <View
        style={{
          position: 'absolute',
          top: (RING_SIZE - 32) / 2,
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: withOpacity(color, 0.12),
        }}
      >
        <Icon size={18} color={color} />
      </View>
      <AppText variant="caption2" weight="semiBold" style={{ marginTop: 6, color }}>
        {value}
      </AppText>
      <AppText variant="caption2" style={{ color: colors.mutedForeground, marginTop: 1 }}>
        {label}
      </AppText>
      <AppText variant="caption2" style={{ color: colors.mutedForeground, opacity: 0.6 }}>
        {Math.round(percent * 100)}% goal
      </AppText>
    </View>
  );
});

RingProgress.displayName = 'RingProgress';
export default RingProgress;
