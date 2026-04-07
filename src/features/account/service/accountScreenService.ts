// src/features/account/service/accountScreenService.ts
import { Activity, Award, Coins, CreditCard, Droplets, Footprints, Package, ShoppingBag, Zap } from 'lucide-react-native';
import { MenuRow, Stat } from '../types/account.types';
import { formatInt } from './accountService';
import { navigate } from '../../../navigation/navigationRef';
import { AccountRoutes, HealthRoutes, RootRoutes, ShopRoutes } from '../../../navigation/routes';
import { formatCoins } from '../../../config/appConfig';

export const accountScreenService = {
  /**
   * @param steps     - today's step count
   * @param hydration - today's hydration (ml)
   * @param calories  - today's calories (kcal)
   * @param coins     - live coin balance from gamification store
   */
  getStatItems: (
    steps: number,
    hydration: number,
    calories: number,
    coins: number,
  ): Stat[] => [
    {
      key: 'steps',
      label: 'STEPS',
      value: formatInt(steps),
      icon: Footprints,
      tint: 'blue',
    },
    {
      key: 'water',
      label: 'WATER',
      value: `${hydration} ml`,
      icon: Droplets,
      tint: 'blue',
    },
    {
      key: 'energy',
      label: 'ENERGY',
      value: `${formatInt(calories)} kcal`,
      icon: Zap,
      tint: 'orange',
    },
    {
      key: 'coins',
      label: 'COINS',
      value: formatCoins(coins),
      icon: Coins,
      tint: 'gold',
    },
  ],

  /**
   * @param orderCount - live pending order count from API (0 → no badge)
   */
  getMenuItems: (orderCount = 0): MenuRow[] => [
    {
      key: 'orders',
      title: 'MY ORDERS',
      icon: ShoppingBag,
      tint: 'gold',
      badge: orderCount > 0 ? orderCount : undefined,
      onPress: () =>
        navigate(RootRoutes.SHOP_NAVIGATOR, {
          screen: ShopRoutes.ORDER_HISTORY,
        }),
    },
    {
      key: 'payments',
      title: 'COIN WALLET',
      icon: Coins,
      tint: 'gold',
      onPress: () =>
        navigate(RootRoutes.HEALTH_NAVIGATOR, {
          screen: HealthRoutes.COINS,
        }),
    },
    {
      key: 'achievements',
      title: 'ACHIEVEMENTS',
      icon: Award,
      tint: 'yellow',
      onPress: () => {},
    },
    {
      key: 'reports',
      title: 'HEALTH REPORTS',
      icon: Activity,
      tint: 'pink',
      onPress: () => {
        navigate(RootRoutes.HEALTH_NAVIGATOR, {
          screen: HealthRoutes.HEALTH_ANALYTICS,
        });
      },
    },
  ],
};
