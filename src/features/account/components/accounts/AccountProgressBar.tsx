import { memo, useMemo } from 'react';
import { useAccountStyles } from './useAccountStyles';
import { AppView } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';

export const AccountProgressBar = memo(({ value }: { value: number }) => {
  const { colors } = useTheme();
  const s = useMemo(() => useAccountStyles(colors), [colors]);

  return (
    <AppView style={s.progressTrack}>
      <AppView
        style={[s.progressFill, { width: `${Math.round(value * 100)}%` }]}
      />
    </AppView>
  );
});
