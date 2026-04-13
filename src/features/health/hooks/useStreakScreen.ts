
import { useTheme } from '../../../hooks/useTheme';
import { useStreaks } from './useStreaks';

export const useStreakScreen = () => {
  const { colors } = useTheme();
  const {
    streakDays,
    bestStreakDays,
    nextBadgeAt,
    badges,
    isLoading,
    isRefetching,
    refetch,
  } = useStreaks();

  const nextTarget = nextBadgeAt ?? (badges.every(b => b.unlocked) ? 30 : 1);

  return {
    colors,
    streakDays,
    bestStreakDays,
    nextTarget,
    nextBadgeAt,
    badges,
    isLoading,
    isRefetching,
    refetch,
  };
};
