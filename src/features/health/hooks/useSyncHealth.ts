import { useMutation, useQueryClient } from '@tanstack/react-query';
import notifee, { AndroidImportance, AndroidColor } from '@notifee/react-native';
import { Platform } from 'react-native';
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
      healthService.syncHealthData(data),

    onSuccess: (response: any) => {
      const d = response?.data;

      queryClient.invalidateQueries({ queryKey: ['coin-data'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
      queryClient.invalidateQueries({ queryKey: ['challenges'] });

      if (d?.goalCoinsAwarded) {
        if (d.coinsBalance !== undefined) setCoinsBalance(d.coinsBalance);
        showStepGoalNotification(d.stepGoalCoins ?? 50);
      }

      if (d?.newlyCompleted?.length) {
        if (d.coinsBalance !== undefined) setCoinsBalance(d.coinsBalance);
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
