// src/features/account/service/notificationPrefs.service.ts
//
// Per-category push preferences.
//
// Replaces an all-or-nothing boolean. That boolean had a real cost: a user who
// switched notifications off to stop the daily nudges also stopped receiving
// account-critical notices — step tracking being paused, a scheduled deletion —
// and then had no way to understand why their step count had frozen.

import { api } from '../../../utils/api';
import { ApiResponse } from '../../../types/auth.types';

/** Categories a user may switch off. Mirrors the server's TOGGLEABLE list. */
export type NotificationCategory =
  | 'goal'
  | 'hydration'
  | 'streak'
  | 'challenge'
  | 'coin'
  | 'product'
  | 'heart';

export interface NotificationPreferences {
  /** Off means no pushes at all, including the always-on categories. */
  masterEnabled: boolean;
  categories: Record<NotificationCategory, boolean>;
  /**
   * Types the server refuses to mute individually, sent so the client renders
   * them as always-on rather than hard-coding the list — a category added
   * server-side then needs no app release.
   */
  alwaysOn: string[];
}

export type NotificationPrefsPatch = Partial<
  Record<NotificationCategory, boolean>
> & { masterEnabled?: boolean };

export const notificationPrefsService = {
  get: async () => {
    const response = await api.get<ApiResponse<NotificationPreferences>>(
      'user/notification-preferences',
    );
    return response.data;
  },

  update: async (patch: NotificationPrefsPatch) => {
    const response = await api.patch<ApiResponse<NotificationPreferences>>(
      'user/notification-preferences',
      patch,
    );
    return response.data;
  },
};

/** Display labels. Kept next to the type so adding a category is one edit. */
export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  goal: 'DAILY STEP GOAL',
  hydration: 'WATER REMINDERS',
  streak: 'STREAK UPDATES',
  challenge: 'CHALLENGES',
  coin: 'COINS & REWARDS',
  product: 'SHOP & ORDERS',
  heart: 'HEART RATE ALERTS',
};

export const CATEGORY_ORDER: NotificationCategory[] = [
  'goal',
  'streak',
  'coin',
  'challenge',
  'hydration',
  'heart',
  'product',
];
