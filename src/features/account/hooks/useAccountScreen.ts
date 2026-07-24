// src/features/account/hooks/useAccountScreen.ts
import { useCallback, useMemo } from 'react';
import { useAuthStore } from '../../auth/store/authStore';
import { useHealth } from '../../health/hooks/useHealth';
import { navigate } from '../../../navigation/navigationRef';
import { formatDateLabel } from '../service/accountService';
import { accountScreenService } from '../service/accountScreenService';
import { AccountRoutes, RootRoutes } from '../../../navigation/routes';
import { useGamificationStore } from '../../health/store/gamificationStore';
import { useOrders } from '../../shop/hooks/useShop';

export const useAccountScreen = () => {
  const profile = useAuthStore(s => s.user);
  const stats = useHealth({
    weightKg: Number(profile?.weight) || 70,
    gender: profile?.gender,
  });

  // Live coin balance from Zustand (synced by TrackerScreen.fetchGamification)
  const coinsBalance = useGamificationStore(s => s.coinsBalance);

  // useOrders is now a useQuery — auto-fetches on mount, cached for 2 min
  const { data: ordersData } = useOrders();
  const orderCount = ordersData?.orders?.length ?? 0;

  const onNotifications = useCallback(() => {
    navigate(RootRoutes.ACCOUNT_NAVIGATOR, {
      screen: AccountRoutes.NOTIFICATIONS,
    });
  }, []);

  const onSettings = useCallback(() => {
    navigate(RootRoutes.ACCOUNT_NAVIGATOR, {
      screen: AccountRoutes.SETTINGS,
    });
  }, []);

  const name = useMemo(() => {
    return profile?.name ?? '';
  }, [profile]);

  const premiumLabel = useMemo(() => {
    if (!profile?.dob || profile.age == null) return '';
    return `${formatDateLabel(profile.dob)} (${profile.age})`;
  }, [profile?.dob, profile?.age]);

  const statItems = useMemo(
    () =>
      accountScreenService.getStatItems(
        stats.data.steps,
        stats.data.hydration,
        stats.data.calories,
        coinsBalance,
      ),
    [stats.data.steps, stats.data.hydration, stats.data.calories, coinsBalance],
  );

  const menu = useMemo(
    () => accountScreenService.getMenuItems(orderCount),
    [orderCount],
  );

  return {
    profile,
    name,
    premiumLabel,
    statItems,
    menu,
    onNotifications,
    onSettings,
  };
};
