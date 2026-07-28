import { useMutation, useQueryClient } from '@tanstack/react-query';
import notifee, { AndroidImportance, AndroidColor } from '@notifee/react-native';
import { Platform } from 'react-native';
import { getTimezone } from '../../../utils/timezone';
import { getLocalToday } from '../../../utils/date';
import { healthService } from '../service/health.service';
import { useGamificationStore } from '../store/gamificationStore';
import type { HealthData } from '../types/healthTypes';

// ─── Channel IDs ──────────────────────────────────────────────────────────────

const CHANNEL_STEP_GOAL  = 'step_goal';
const CHANNEL_CHALLENGES = 'challenges';

// ─── Setup channels once ──────────────────────────────────────────────────────

async function setupNotifChannels() {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    notifee.createChannel({
      id:          CHANNEL_STEP_GOAL,
      name:        'Step Goal Rewards',
      importance:  AndroidImportance.HIGH,
      vibration:   true,
      lights:      true,
      lightColor:  AndroidColor.GREEN,
    }),
    notifee.createChannel({
      id:          CHANNEL_CHALLENGES,
      name:        'Challenge Rewards',
      importance:  AndroidImportance.HIGH,
      vibration:   true,
      lights:      true,
      lightColor:  AndroidColor.YELLOW,
    }),
  ]);
}

// ─── Notification helpers ─────────────────────────────────────────────────────

function androidConfig(channelId: string) {
  return {
    channelId,
    smallIcon:   'ic_notification',   // must match drawable/ic_notification.xml
    color:       '#0099FF',
    pressAction: { id: 'default' },
    importance:  AndroidImportance.HIGH,
  };
}

const iosConfig = {
  foregroundPresentationOptions: {
    alert: true,
    badge: false,
    sound: true,
  },
};

export async function showStepGoalNotification(coins: number): Promise<void> {
  try {
    await notifee.displayNotification({
      id:    'step_goal_reward',
      title: '🎉 Step Goal Reached!',
      body:  `You hit your daily step goal and earned ${coins} coins!`,
      android: androidConfig(CHANNEL_STEP_GOAL),
      ios:     iosConfig,
    });
  } catch (e) {
    console.warn('[Notifee] step goal notification failed:', e);
  }
}

export async function showChallengeNotifications(
  completed: { title: string; emoji: string; coinReward: number }[],
): Promise<void> {
  if (!completed.length) return;
  try {
    if (completed.length === 1) {
      const c = completed[0];
      await notifee.displayNotification({
        id:    `challenge_${Date.now()}`,
        title: `${c.emoji} Challenge Complete!`,
        body:  `"${c.title}" done — you earned ${c.coinReward} coins! 🪙`,
        android: androidConfig(CHANNEL_CHALLENGES),
        ios:     iosConfig,
      });
    } else {
      const totalCoins = completed.reduce((s, c) => s + c.coinReward, 0);
      const lines = completed.map(c => `${c.emoji} ${c.title} (+${c.coinReward} coins)`).join('\n');
      await notifee.displayNotification({
        id:    `challenges_${Date.now()}`,
        title: `🏆 ${completed.length} Challenges Complete!`,
        body:  `You earned ${totalCoins} coins!\n${lines}`,
        android: androidConfig(CHANNEL_CHALLENGES),
        ios:     iosConfig,
      });
    }
  } catch (e) {
    console.warn('[Notifee] challenge notification failed:', e);
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSyncHealth() {
  const queryClient = useQueryClient();
  const setCoinsBalance = useGamificationStore(s => s.setCoinsBalance);

  const mutation = useMutation({
    mutationFn: (data: Partial<HealthData> & { date?: string; goalMet?: boolean }) =>
      healthService.syncHealthData({ ...data, timezone: getTimezone() }),

    onSuccess: (response: any) => {
      const d = response?.data;

      // Always sync the server's coinsBalance to the local store.
      // The server is the single source of truth for balance — the frontend
      // only displays it, never independently accumulates.
      if (d?.coinsBalance !== undefined) {
        setCoinsBalance(d.coinsBalance);
      }

      // Sync coin block status from the sync response immediately.
      // This ensures the CoinBlockedBanner appears/disappears instantly when the
      // user's block status changes, without waiting for the gamification query.
      // - If coinBlocked is present (user is blocked): write it to store → banner shows
      // - If coinBlocked is absent/undefined (user not blocked): clear store → banner hides
      // This handles both new blocks AND block expiry.
      if (d?.coinBlocked) {
        useGamificationStore.getState().syncWithService({ coinBlocked: d.coinBlocked });
      } else if (useGamificationStore.getState().coinBlocked?.blocked) {
        // Block status was previously set but server no longer returns it — block expired
        useGamificationStore.getState().syncWithService({ coinBlocked: null });
      }

      // Store bonus steps from server so the UI shows walked + bonus
      if (d?.bonusSteps !== undefined && d.bonusSteps > 0) {
        const today = getLocalToday();
        const { useHealthDataStore } = require('../store/healthDataStore');
        useHealthDataStore.getState().setBonusSteps(d.bonusSteps, today);

        // Push total steps (device + bonus) to notification and widget
        // so they also reflect the bonus-adjusted count.
        if (d.totalSteps && d.totalSteps > 0) {
          import('../../../services/stepService').then(({ stepService }) => {
            stepService.forceRefreshSteps(d.totalSteps).catch(() => {});
          });
        }
      }

      // If server has more total steps than what the app currently displays,
      // push to notification and widget immediately.
      // NOTE: Do NOT update healthDataStore.data here — it conflicts with
      // useHealth's loadData which overwrites the store on every poll.
      // The next loadData (90s max) will read the correct value via
      // server baseline. Updating store here causes oscillation.
      if (d?.totalSteps && d.totalSteps > 0) {
        // Push to notification and widget
        import('../../../services/stepService').then(({ stepService }) => {
          stepService.forceRefreshSteps(d.totalSteps).catch(() => {});
        });
      }

      // Always invalidate weekly-steps after a sync so the chart reflects
      // the freshly written data immediately — no stale bar for today.
      queryClient.invalidateQueries({ queryKey: ['weekly-steps'] });

      // Always invalidate streaks — the server may have incremented the streak
      // counter even when no coins were awarded (e.g. goal met but coins already
      // claimed today). Keeping this stale would show the wrong streak count.
      queryClient.invalidateQueries({ queryKey: ['streaks'] });

      // Always invalidate challenges after a sync — the period key may have
      // changed (e.g. after midnight) and progress needs to reflect the new day.
      queryClient.invalidateQueries({ queryKey: ['challenges'] });

      // Always invalidate coin-data after a sync — even when no coins are
      // awarded — because claimable reward state may have changed (e.g. hydration
      // goal met makes hydration_daily claimable, or step validation changed state).
      queryClient.invalidateQueries({ queryKey: ['coin-data'] });
      queryClient.invalidateQueries({ queryKey: ['coin-transactions'] });

      // Refresh gamification if coins were awarded OR if cheat warning/block changed
      const awardedCoins = d?.goalCoinsAwarded || d?.newlyCompleted?.length > 0;
      if (awardedCoins || d?.coinBlocked || d?.cheatWarning) {
        queryClient.invalidateQueries({ queryKey: ['gamification'] });
      }

      if (d?.goalCoinsAwarded) {
        showStepGoalNotification(d.stepGoalCoins ?? 50);
      }

      if (d?.newlyCompleted?.length) {
        showChallengeNotifications(d.newlyCompleted);
      }
    },
  });

  return {
    syncHealth: mutation.mutate,
    isPending:  mutation.isPending,
  };
}

// Export channel setup so App.tsx can call it after permission is granted
export { setupNotifChannels };
