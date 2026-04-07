import { memo, useMemo } from 'react';

import { useAccountStyles } from './useAccountStyles';
import { Pressable } from 'react-native';
import { useTheme } from '../../../../hooks/useTheme';

export const AccountIconPill = memo(
  ({
    children,
    onPress,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
  }) => {
    const { colors } = useTheme();
    const s = useMemo(() => useAccountStyles(colors), [colors]);
    return (
      <Pressable onPress={onPress} hitSlop={10} style={s.iconPill}>
        {children}
      </Pressable>
    );
  },
);
