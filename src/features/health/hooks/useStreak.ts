// useStreak delegates to useStreaks so both hooks share the same React Query
// cache entry (['streaks']). A single network request is made regardless of
// how many components call either hook simultaneously.
import { useStreaks } from './useStreaks';
import type { StreaksResponseData } from '../types/gamification.type';

export function useStreak() {
  const { streakDays, bestStreakDays, nextBadgeAt, badges, isLoading, isRefetching, refetch } =
    useStreaks();

  // Reconstruct the StreaksResponseData shape so callers don't need to change.
  const streakData: StreaksResponseData | null =
    streakDays !== undefined
      ? { streakDays, bestStreakDays, nextBadgeAt, badges }
      : null;

  return {
    streakData,
    isPending: isLoading,
    isRefetching,
    // Expose mutate/mutateAsync as no-ops for any legacy callers that still
    // call fetchStreakData() — the query auto-fetches on mount so this is a
    // safe no-op.
    mutate: refetch,
    mutateAsync: async () => { await refetch(); },
    refetch,
  };
}
