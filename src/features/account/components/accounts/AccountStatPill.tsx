// src/features/account/components/accounts/AccountStatPill.tsx
import { memo, useMemo } from 'react';
import { useAccountStyles } from './useAccountStyles';
import { useTheme } from '../../../../hooks/useTheme';
import { AppText, AppView } from '../../../../components';
import { Stat } from '../../types/account.types';

const TINT_COLORS: Record<Stat['tint'], string> = {
  blue: '',    // falls back to colors.primary
  orange: '',  // falls back to colors.warning
  gold: '#B45309',
};

export const AccountStatPill = memo(({ item }: { item: Stat }) => {
  const { colors } = useTheme();
  const s = useMemo(() => useAccountStyles(colors), [colors]);

  const iconColor =
    item.tint === 'gold'
      ? TINT_COLORS.gold
      : item.tint === 'orange'
      ? colors.warning ?? colors.primary
      : colors.primary;

  return (
    <AppView style={s.statPill}>
      <AppView style={s.statTop}>
        <item.icon size={16} color={iconColor} />
        <AppText style={s.statLabel}>{item.label}</AppText>
      </AppView>
      <AppText
        style={[
          s.statValue,
          item.tint === 'gold' && { color: '#92400E' },
        ]}
      >
        {item.value}
      </AppText>
    </AppView>
  );
});

AccountStatPill.displayName = 'AccountStatPill';
