import { useMutation, useQueryClient } from '@tanstack/react-query';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { healthService } from '../service/health.service';
import { useGamificationStore } from '../store/gamificationStore';
import type { HealthData } from '../types/healthTypes';

async function showGoalNotification(coins: number): Promise<void> {
  try {
    const channelId = await notifee.createChannel({
      id: 'step_goal',
      name: 'Step Goal Rewards',
      importance: AndroidImportance.HIGH,
    });

    await notifee.displayNotification({
      title: '🎉 Step Goal Reached!',
      body: `You hit your daily step goal and earned ${coins} coins automatically!`,
      android: {
        channelId,
        smallIcon: 'ic_notification',
        pressAction: { id: 'default' },
      },
      ios: {
        foregroundPresentationOptions: {
          alert: true,
          badge: true,
          sound: true,
        },
      },
    });
  } catch {
    // Non-fatal — notification is a bonus, not critical
  }
}

export function useSyncHealth() {
  const queryClient = useQueryClient();
  const setCoinsBalance = useGamificationStore(s => s.setCoinsBalance);

  const mutation = useMutation({
    mutationFn: (data: Partial<HealthData> & { date?: string; goalMet?: boolean }) =>
      healthService.syncHealthData(data),
    onSuccess: (response: any) => {
      // Invalidate coin-data to refresh the coins screen
      queryClient.invalidateQueries({ queryKey: ['coin-data'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });

      // If the backend auto-awarded step goal coins, update the store and notify
      if (response?.data?.goalCoinsAwarded) {
        const newBalance = response.data.coinsBalance;
        const coins = response.data.stepGoalCoins;

        if (newBalance !== undefined) {
          setCoinsBalance(newBalance);
        }

        showGoalNotification(coins);
      }
    },
  });

  return {
    syncHealth: mutation.mutate,
    isPending: mutation.isPending,
  };
}
