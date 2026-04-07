import { memo, useMemo } from 'react';
import { useAccountStyles } from './useAccountStyles';
import { AccountProgressBar } from './AccountProgressBar';
import { AppText, AppView, Card, Icon } from '../../../../components';
import { withOpacity } from '../../../../utils/withOpacity';
import { useTheme } from '../../../../hooks/useTheme';
import { formatInt } from '../../service/accountService';

export const AccountTierCard = memo(
  ({
    label,
    xp,
    xpGoal,
    hint,
    progress,
  }: {
    label: string;
    xp: number;
    xpGoal: number;
    hint: string;
    progress: number;
  }) => {
    const {colors} = useTheme()
    const s = useMemo(() => useAccountStyles(colors), [colors]);

    return (
      <Card style={s.tierCard}>
        {/* watermark star */}
        <AppView pointerEvents="none" style={s.tierWatermark}>
          <Icon
            name="Star"
            size={120}
            color={withOpacity('#FFFFFF', 0.08)}
          />
        </AppView>

        <AppView style={s.tierTop}>
          <AppView style={s.tierLeft}>
            <Icon
              name="Star"
              size={18}
              color={colors.warning ?? '#FFC83D'}
            />
            <AppText style={s.tierLabel}>{label}</AppText>
          </AppView>

          <AppText style={s.tierXp}>
            {formatInt(xp)} XP / {formatInt(xpGoal)} XP
          </AppText>
        </AppView>

        <AccountProgressBar value={progress} />

        <AppText style={s.tierHint} numberOfLines={2}>
          {hint}
        </AppText>
      </Card>
    );
  },
);
