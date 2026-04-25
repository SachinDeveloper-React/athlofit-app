// src/navigation/linkingConfig.ts
//
// React Navigation deep link configuration.
// Handles both custom scheme (athlofit://) and universal links (https://athlofit.app).
//
// URL examples:
//   athlofit://tracker
//   athlofit://shop/product/abc123
//   athlofit://health/challenge/xyz
//   athlofit://account/notifications
//   https://athlofit.app/shop/product/abc123

import type { LinkingOptions } from '@react-navigation/native';
import { Linking } from 'react-native';
import type { RootStackParamList } from '../types/navigation.types';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    'athlofit://',
    'https://athlofit.app',
    'http://athlofit.app',
  ],

  // Custom getInitialURL — also handles FCM notification deep links
  async getInitialURL() {
    // 1. Check if app was opened from a regular deep link
    const url = await Linking.getInitialURL();
    if (url) return url;
    return null;
  },

  // Subscribe to incoming links while app is open
  subscribe(listener) {
    const sub = Linking.addEventListener('url', ({ url }) => listener(url));
    return () => sub.remove();
  },

  config: {
    screens: {
      // ── Auth ──────────────────────────────────────────────────────────
      AuthStack: {
        path: 'auth',
        screens: {
          Login:          'login',
          Signup:         'signup',
          ForgotPassword: 'forgot-password',
          Otp:            'otp',
          ResetPassword:  'reset-password',
        },
      },

      // ── Profile Setup ─────────────────────────────────────────────────
      ProfileSetupStack: {
        path: 'setup',
        screens: {
          CompleteProfile: 'complete-profile',
        },
      },

      // ── Main Tab Navigator ────────────────────────────────────────────
      TabNavigator: {
        path: '',
        screens: {
          Tracker: 'tracker',
          Shop:    'shop',
          Account: 'account',
        },
      },

      // ── Health Stack ──────────────────────────────────────────────────
      HealthStack: {
        path: 'health',
        screens: {
          TrackerScreen:        'tracker',
          StepsScreen:          'steps',
          CaloriesScreen:       'calories',
          HeartRateScreen:      'heart-rate',
          BloodPressureScreen:  'blood-pressure',
          HydrationScreen:      'hydration',
          EditStepsGoalScreen:  'steps-goal',
          HealthAnalyticsScreen:'analytics',
          StreakScreen:         'streak',
          CoinsScreen:          'coins',
          FoodCatalogScreen:    'food',
          FoodDetailScreen:     {
            path: 'food/:foodId',
            parse: { foodId: String },
          },
          BmiCalculatorScreen:  'bmi',
          LeaderboardScreen:    'leaderboard',
          ChallengesScreen:     'challenges',
          ChallengeDetailScreen: {
            path: 'challenge/:challengeId',
            parse: { challengeId: String },
          },
        },
      },

      // ── Shop Stack ────────────────────────────────────────────────────
      ShopStack: {
        path: 'shop',
        screens: {
          ShopScreen:         '',
          ShopSearchScreen:   'search',
          ProductDetailScreen: {
            path: 'product/:productId',
            parse: { productId: String },
          },
          CartScreen:         'cart',
          CheckoutScreen:     'checkout',
          OrderHistoryScreen: 'orders',
          AddressesScreen:    'addresses',
          AddEditAddressScreen: {
            path: 'addresses/:addressId',
            parse: { addressId: String },
          },
        },
      },

      // ── Account Stack ─────────────────────────────────────────────────
      AccountStack: {
        path: 'account',
        screens: {
          AccountScreen:      '',
          SettingsScreen:     'settings',
          EditProfileScreen:  'edit-profile',
          NotificationsScreen:'notifications',
          PrivacyScreen:      'privacy',
          TermsScreen:        'terms',
          HelpSupportScreen:  'help',
          AchievementsScreen: 'achievements',
          ReferralScreen:     'referral',
        },
      },
    },
  },
};
