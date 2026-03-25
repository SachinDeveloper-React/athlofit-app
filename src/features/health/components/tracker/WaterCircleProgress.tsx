import React, { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { AppView, Icon } from '../../../../components';

type Props = {
  value: number; // e.g. 1220
  max: number; // e.g. 2500
  size?: number; // default 56
  strokeWidth?: number; // default 8
};

export const WaterCircleProgress = memo(
  ({ value, max, size = 56, strokeWidth = 8 }: Props) => {
    const { colors } = useTheme();

    const clamped = Math.max(0, Math.min(value, max));
    const progress = max <= 0 ? 0 : clamped / max;

    const radius = useMemo(() => (size - strokeWidth) / 2, [size, strokeWidth]);
    const cx = size / 2;
    const cy = size / 2;

    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - progress);

    const trackColor = withOpacity(colors.foreground, 0.1);
    const ringColor = '#00BFFF';

    return (
      <AppView
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={size} height={size}>
          {/* Track */}
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="none"
          />

          {/* Progress */}
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={ringColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            // start from top
            rotation={-90}
            origin={`${cx}, ${cy}`}
          />
        </Svg>

        {/* Icon inside */}
        <AppView style={StyleSheet.absoluteFill as any} pointerEvents="none">
          <AppView style={styles.center}>
            <Icon
              name="Droplet"
              size={26}
              color={withOpacity('#00BFFF', 0.95)}
            />
          </AppView>
        </AppView>
      </AppView>
    );
  },
);

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
