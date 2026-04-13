import React from 'react';
import { View } from 'react-native';
import { AppText } from '../../../../components';

interface StreakRingProps {
  current: number;
  max: number;
  size?: number;
  color: string;
}

export const StreakRing: React.FC<StreakRingProps> = ({ current, max, size = 140, color }) => {
  const pct = max > 0 ? Math.min(current / max, 1) : 0;
  const strokeW = 12;
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Background track (pure View circle) */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeW,
          borderColor: color + '22',
        }}
      />
      {/* Filled arc overlay — approximated with border clipping */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeW,
          borderTopColor: pct >= 0.25 ? color : 'transparent',
          borderRightColor: pct >= 0.5 ? color : 'transparent',
          borderBottomColor: pct >= 0.75 ? color : 'transparent',
          borderLeftColor: pct >= 1 ? color : 'transparent',
          transform: [{ rotate: '-90deg' }],
        }}
      />
      <AppText
        variant="largeTitle"
        weight="bold"
        style={{ color, fontSize: 36 }}
      >
        {current}
      </AppText>
      <AppText
        variant="caption1"
        style={{ color: color + 'cc', marginTop: -4 }}
      >
        DAYS
      </AppText>
    </View>
  );
};
