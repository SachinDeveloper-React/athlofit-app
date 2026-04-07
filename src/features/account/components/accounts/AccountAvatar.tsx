import { memo, useMemo } from 'react';
import { useAccountStyles } from './useAccountStyles';

import { Image } from 'react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { AppView } from '../../../../components';

export const AccountAvatar = memo(({ uri }: { uri?: string }) => {
  const { colors } = useTheme();
  const s = useMemo(() => useAccountStyles(colors), [colors]);

  return (
    <AppView style={s.avatarWrap}>
      {uri ? (
        <Image source={{ uri }} style={s.avatarImg} />
      ) : (
        <AppView style={s.avatarPlaceholder} />
      )}
    </AppView>
  );
});
