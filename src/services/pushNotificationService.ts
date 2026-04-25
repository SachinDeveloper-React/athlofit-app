// src/services/pushNotificationService.ts
//
// Handles displaying incoming FCM messages via Notifee,
// and resolves deep-link navigation from notification data.

import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AndroidStyle,
} from '@notifee/react-native';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { navigate } from '../navigation/navigationRef';
import {
  RootRoutes,
  TabRoutes,
  HealthRoutes,
  ShopRoutes,
  AccountRoutes,
} from '../navigation/routes';

// ─── Channel IDs ──────────────────────────────────────────────────────────────

export const PUSH_CHANNEL_ID = 'athlofit_push';

// ─── Create notification channel (Android) ───────────────────────────────────

export async function createPushChannel(): Promise<void> {
  await notifee.createChannel({
    id: PUSH_CHANNEL_ID,
    name: 'Athlofit Notifications',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'default',
    vibration: true,
  });
}

// ─── Display a remote message as a local Notifee notification ────────────────
// Supports: title, body, imageUrl (big picture), data deep-link

export async function displayPushNotification(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  const { notification, data } = remoteMessage;
  if (!notification?.title && !notification?.body) return;

  const imageUrl = notification?.android?.imageUrl
    ?? notification?.apple?.imageUrl
    ?? (data?.imageUrl as string | undefined);

  await notifee.displayNotification({
    title: notification?.title ?? '',
    body:  notification?.body  ?? '',
    data:  data ?? {},
    android: {
      channelId:   PUSH_CHANNEL_ID,
      smallIcon:   'ic_notification',
      pressAction: { id: 'default' },
      importance:  AndroidImportance.HIGH,
      // Show large image if provided
      ...(imageUrl && {
        style: {
          type:        AndroidStyle.BIGPICTURE,
          picture:     imageUrl,
          largeIcon:   imageUrl,
        },
      }),
    },
    ios: {
      sound:      'default',
      badgeCount: 1,
      ...(imageUrl && { attachments: [{ url: imageUrl }] }),
    },
  });
}

// ─── Deep-link screen map ─────────────────────────────────────────────────────
//
// FCM data payload shape sent from backend:
//   {
//     screen:  'ProductDetail',
//     params:  '{"productId":"abc123"}',   // JSON string
//     type:    'PRODUCT',
//     imageUrl: 'https://...',             // optional
//   }
//
// All valid screen values:

export type NotificationScreen =
  // Tab roots
  | 'Tracker' | 'Shop' | 'Account'
  // Health
  | 'TrackerScreen' | 'StepsScreen' | 'CaloriesScreen' | 'HeartRateScreen'
  | 'BloodPressureScreen' | 'HydrationScreen' | 'HealthAnalyticsScreen'
  | 'StreakScreen' | 'CoinsScreen' | 'LeaderboardScreen'
  | 'ChallengesScreen' | 'ChallengeDetailScreen'
  | 'FoodCatalogScreen' | 'FoodDetailScreen' | 'BmiCalculatorScreen'
  // Shop
  | 'ShopScreen' | 'ShopSearchScreen' | 'ProductDetailScreen'
  | 'CartScreen' | 'CheckoutScreen' | 'OrderHistoryScreen' | 'AddressesScreen'
  // Account
  | 'AccountScreen' | 'NotificationsScreen' | 'SettingsScreen' | 'EditProfileScreen'
  | 'AchievementsScreen' | 'ReferralScreen' | 'PrivacyScreen' | 'TermsScreen'
  | 'HelpSupportScreen';

export function handleNotificationNavigation(
  data?: Record<string, string>,
): void {
  if (!data?.screen) return;

  const screen = data.screen as NotificationScreen;
  let params: Record<string, unknown> = {};

  try {
    if (data.params) params = JSON.parse(data.params);
  } catch { /* ignore malformed params */ }

  switch (screen) {

    // ── Tab roots ────────────────────────────────────────────────────────
    case 'Tracker':
      navigate(RootRoutes.TAB_NAVIGATOR, { screen: TabRoutes.TRACKER } as any);
      break;
    case 'Shop':
      navigate(RootRoutes.TAB_NAVIGATOR, { screen: TabRoutes.SHOP } as any);
      break;
    case 'Account':
      navigate(RootRoutes.TAB_NAVIGATOR, { screen: TabRoutes.ACCOUNT } as any);
      break;

    // ── Health screens ───────────────────────────────────────────────────
    case 'TrackerScreen':
      navigate(RootRoutes.HEALTH_NAVIGATOR, { screen: HealthRoutes.TRACKER } as any);
      break;
    case 'StepsScreen':
      navigate(RootRoutes.HEALTH_NAVIGATOR, { screen: HealthRoutes.STEPS } as any);
      break;
    case 'CaloriesScreen':
      navigate(RootRoutes.HEALTH_NAVIGATOR, { screen: HealthRoutes.CALORIES } as any);
      break;
    case 'HeartRateScreen':
      navigate(RootRoutes.HEALTH_NAVIGATOR, { screen: HealthRoutes.HEART_RATE } as any);
      break;
    case 'BloodPressureScreen':
      navigate(RootRoutes.HEALTH_NAVIGATOR, { screen: HealthRoutes.BLOOD_PRESSURE } as any);
      break;
    case 'HydrationScreen':
      navigate(RootRoutes.HEALTH_NAVIGATOR, { screen: HealthRoutes.HYDRATION } as any);
      break;
    case 'HealthAnalyticsScreen':
      navigate(RootRoutes.HEALTH_NAVIGATOR, { screen: HealthRoutes.ANALYTICS } as any);
      break;
    case 'StreakScreen':
      navigate(RootRoutes.HEALTH_NAVIGATOR, { screen: HealthRoutes.STREAK } as any);
      break;
    case 'CoinsScreen':
      navigate(RootRoutes.HEALTH_NAVIGATOR, { screen: HealthRoutes.COINS } as any);
      break;
    case 'LeaderboardScreen':
      navigate(RootRoutes.HEALTH_NAVIGATOR, { screen: HealthRoutes.LEADERBOARD } as any);
      break;
    case 'ChallengesScreen':
      navigate(RootRoutes.HEALTH_NAVIGATOR, { screen: HealthRoutes.CHALLENGES } as any);
      break;
    case 'ChallengeDetailScreen':
      navigate(RootRoutes.HEALTH_NAVIGATOR, {
        screen: HealthRoutes.CHALLENGE_DETAIL,
        params: { challengeId: params.challengeId as string },
      } as any);
      break;
    case 'FoodCatalogScreen':
      navigate(RootRoutes.HEALTH_NAVIGATOR, { screen: HealthRoutes.FOOD_CATALOG } as any);
      break;
    case 'FoodDetailScreen':
      navigate(RootRoutes.HEALTH_NAVIGATOR, {
        screen: HealthRoutes.FOOD_DETAIL,
        params: { foodId: params.foodId as string },
      } as any);
      break;
    case 'BmiCalculatorScreen':
      navigate(RootRoutes.HEALTH_NAVIGATOR, { screen: HealthRoutes.BMI_CALCULATOR } as any);
      break;

    // ── Shop screens ─────────────────────────────────────────────────────
    case 'ShopScreen':
      navigate(RootRoutes.TAB_NAVIGATOR, { screen: TabRoutes.SHOP } as any);
      break;
    case 'ProductDetailScreen':
      navigate(RootRoutes.SHOP_NAVIGATOR, {
        screen: ShopRoutes.PRODUCT_DETAIL,
        params: { productId: params.productId as string },
      } as any);
      break;
    case 'CartScreen':
      navigate(RootRoutes.SHOP_NAVIGATOR, { screen: ShopRoutes.CART } as any);
      break;
    case 'CheckoutScreen':
      navigate(RootRoutes.SHOP_NAVIGATOR, { screen: ShopRoutes.CHECKOUT } as any);
      break;
    case 'OrderHistoryScreen':
      navigate(RootRoutes.SHOP_NAVIGATOR, { screen: ShopRoutes.ORDER_HISTORY } as any);
      break;
    case 'AddressesScreen':
      navigate(RootRoutes.SHOP_NAVIGATOR, { screen: ShopRoutes.ADDRESSES } as any);
      break;

    // ── Account screens ──────────────────────────────────────────────────
    case 'AccountScreen':
      navigate(RootRoutes.TAB_NAVIGATOR, { screen: TabRoutes.ACCOUNT } as any);
      break;
    case 'NotificationsScreen':
      navigate(RootRoutes.ACCOUNT_NAVIGATOR, { screen: AccountRoutes.NOTIFICATIONS } as any);
      break;
    case 'SettingsScreen':
      navigate(RootRoutes.ACCOUNT_NAVIGATOR, { screen: AccountRoutes.SETTINGS } as any);
      break;
    case 'EditProfileScreen':
      navigate(RootRoutes.ACCOUNT_NAVIGATOR, { screen: AccountRoutes.EDIT_PROFILE } as any);
      break;
    case 'AchievementsScreen':
      navigate(RootRoutes.ACCOUNT_NAVIGATOR, { screen: AccountRoutes.ACHIEVEMENTS } as any);
      break;
    case 'ReferralScreen':
      navigate(RootRoutes.ACCOUNT_NAVIGATOR, { screen: AccountRoutes.REFERRAL } as any);
      break;
    case 'PrivacyScreen':
      navigate(RootRoutes.ACCOUNT_NAVIGATOR, { screen: AccountRoutes.PRIVACY } as any);
      break;
    case 'TermsScreen':
      navigate(RootRoutes.ACCOUNT_NAVIGATOR, { screen: AccountRoutes.TERMS } as any);
      break;
    case 'HelpSupportScreen':
      navigate(RootRoutes.ACCOUNT_NAVIGATOR, { screen: AccountRoutes.HELP_SUPPORT } as any);
      break;

    default:
      navigate(RootRoutes.ACCOUNT_NAVIGATOR, { screen: AccountRoutes.NOTIFICATIONS } as any);
  }
}
