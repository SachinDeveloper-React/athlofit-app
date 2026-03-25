import { memo, useCallback } from 'react';
import { Icon, LucideName } from './Icon';
import {
  Pressable,
  PressableStateCallbackType,
  StyleSheet,
  ViewStyle,
} from 'react-native';

type IconButtonProps = {
  name: LucideName;
  onPress: () => void;
  borderColor: string;
  borderRadius: number;
};

const ICON_SIZE = 12;
const PRESS_SCALE = 0.92;

export const IconButton = memo(
  ({ name, onPress, borderColor, borderRadius }: IconButtonProps) => {
    const pressStyle = useCallback(
      ({ pressed }: PressableStateCallbackType): ViewStyle => ({
        borderWidth: StyleSheet.hairlineWidth,
        borderColor,
        padding: 10,
        borderRadius,
        transform: [{ scale: pressed ? PRESS_SCALE : 1 }],
      }),
      [borderColor, borderRadius],
    );

    return (
      <Pressable onPress={onPress} style={pressStyle} hitSlop={8}>
        <Icon name={name} size={ICON_SIZE} />
      </Pressable>
    );
  },
);

IconButton.displayName = 'IconButton';
