// src/services/fcmService.ts
//
// Manages FCM token lifecycle:
//   - Request permission
//   - Get & register token with backend
//   - Handle token refresh
//   - Clear token on logout

import {
  getMessaging,
  getToken,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  requestPermission,
  AuthorizationStatus,
  isDeviceRegisteredForRemoteMessages,
} from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import { api } from '../utils/api';
import { tokenService } from '../features/auth/service/tokenService';

// ─── Register FCM token with backend ─────────────────────────────────────────

export async function registerFcmToken(): Promise<string | null> {
  try {
    const messaging = getMessaging();

    // iOS: must register for remote messages first
    if (Platform.OS === 'ios') {
      const isRegistered = isDeviceRegisteredForRemoteMessages(messaging);
      if (!isRegistered) {
        await registerDeviceForRemoteMessages(messaging);
      }
    }

    // Check permission
    const authStatus = await requestPermission(messaging);
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      // Permission denied — clear any stored token
      await syncFcmToken(null, false);
      return null;
    }

    const token = await getToken(messaging);
    await syncFcmToken(token, true);
    return token;
  } catch (err) {
    console.warn('[FCM] registerFcmToken failed:', err);
    return null;
  }
}

// ─── Sync token to backend (only if authenticated) ───────────────────────────

async function syncFcmToken(
  fcmToken: string | null,
  notificationsEnabled: boolean,
): Promise<void> {
  const hasSession = await tokenService.getAccessToken();
  if (!hasSession) return;

  try {
    await api.patch('user/fcm-token', {
      fcmToken,
      notificationsEnabled,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
  } catch (err) {
    console.warn('[FCM] syncFcmToken failed:', err);
  }
}

// ─── Subscribe to token refresh ───────────────────────────────────────────────
// Call once on app start. Returns unsubscribe fn.

export function subscribeToTokenRefresh(): () => void {
  const messaging = getMessaging();
  return onTokenRefresh(messaging, async newToken => {
    console.log('[FCM] Token refreshed');
    await syncFcmToken(newToken, true);
  });
}

// ─── Clear token on logout ────────────────────────────────────────────────────

export async function clearFcmToken(): Promise<void> {
  await syncFcmToken(null, false);
}
