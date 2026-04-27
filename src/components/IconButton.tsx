import { memo, useCallback } from 'react';
import { Icon, LucideName } from './Icon';
import { Pressable, PressableStateCallbackType, ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

type IconButtonProps = {
  name: LucideName;
  onPress: () => void;
  borderColor?: string;
  borderRadius?: number;
  size?: number;
};

const PRESS_SCALE = 0.92;

export const IconButton = memo(({ name, onPress, borderColor, borderRadius, size }: IconButtonProps) => {
  const { colors, spacing, radius } = useTheme();

  const pressStyle = useCallback(
    ({ pressed }: PressableStateCallbackType): ViewStyle => ({
      borderWidth: 0.5,
      borderColor: borderColor ?? colors.border,
      padding: spacing[2],
      borderRadius: borderRadius ?? radius.md,
      transform: [{ scale: pressed ? PRESS_SCALE : 1 }],
    }),
    [borderColor, borderRadius, colors.border, spacing, radius],
  );

  return (
    <Pressable onPress={onPress} style={pressStyle} hitSlop={8}>
      <Icon name={name} size={size ?? 14} />
    </Pressable>
  );
});

IconButton.displayName = 'IconButton';
