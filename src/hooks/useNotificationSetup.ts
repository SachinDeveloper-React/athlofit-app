// src/hooks/useNotificationSetup.ts

import { useEffect } from 'react';
import {
  getMessaging,
  onMessage,
  getInitialNotification,
  onNotificationOpenedApp,
} from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../features/auth/store/authStore';
import { registerFcmToken, subscribeToTokenRefresh } from '../services/fcmService';
import {
  createPushChannel,
  displayPushNotification,
  handleNotificationNavigation,
} from '../services/pushNotificationService';
import { api } from '../utils/api';
import { NOTIF_KEY } from '../features/account/hooks/useNotifications';
import { navigationRef } from '../navigation/navigationRef';

// ─── Wait for navigator to be ready, then navigate ───────────────────────────

function navigateWhenReady(data?: Record<string, string>): void {
  if (!data?.screen) return;

  if (navigationRef.isReady()) {
    handleNotificationNavigation(data);
    return;
  }

  // Navigator not ready yet (quit-state) — poll until it is
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    if (navigationRef.isReady()) {
      clearInterval(interval);
      handleNotificationNavigation(data);
    } else if (attempts > 20) {
      // Give up after 2 seconds
      clearInterval(interval);
    }
  }, 100);
}

// ─── Persist notification to backend DB ──────────────────────────────────────

async function persistNotification(remoteMessage: any): Promise<void> {
  try {
    const { notification, data } = remoteMessage;
    if (!notification?.title) return;
    await api.post('user/notifications', {
      type:    data?.type    || 'GOAL',
      title:   notification.title,
      message: notification.body ?? '',
      data:    data ?? {},
    });
  } catch { /* non-critical */ }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotificationSetup(): void {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const qc = useQueryClient();

  // ── 1. Create Notifee channel ─────────────────────────────────────────────
  useEffect(() => {
    createPushChannel();
  }, []);

  // ── 2 & 3. Register FCM token on login ───────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    let unsubRefresh: (() => void) | undefined;
    registerFcmToken().then(() => {
      unsubRefresh = subscribeToTokenRefresh();
    });
    return () => unsubRefresh?.();
  }, [isAuthenticated]);

  // ── 4. Foreground FCM → display via Notifee + persist to DB ─────────────
  // (Notifee press is handled in step 5)
  useEffect(() => {
    const messaging = getMessaging();
    const unsub = onMessage(messaging, async remoteMessage => {
      await displayPushNotification(remoteMessage);
      if (isAuthenticated) {
        await persistNotification(remoteMessage);
        qc.invalidateQueries({ queryKey: NOTIF_KEY });
      }
    });
    return unsub;
  }, [isAuthenticated, qc]);

  // ── 5. Notifee foreground press → navigate ────────────────────────────────
  useEffect(() => {
    const unsub = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) {
        const data = detail.notification?.data as Record<string, string> | undefined;
        handleNotificationNavigation(data);
      }
    });
    return unsub;
  }, []);

  // ── 6. FCM background press (app in background, user taps notification) ──
  // This was MISSING — onNotificationOpenedApp fires when app is backgrounded
  useEffect(() => {
    const messaging = getMessaging();
    const unsub = onNotificationOpenedApp(messaging, async remoteMessage => {
      if (isAuthenticated) {
        await persistNotification(remoteMessage);
        qc.invalidateQueries({ queryKey: NOTIF_KEY });
      }
      navigateWhenReady(remoteMessage.data as Record<string, string>);
    });
    return unsub;
  }, [isAuthenticated, qc]);

  // ── 7. Quit-state: app opened by tapping notification ────────────────────
  // getInitialNotification fires once when app cold-starts from a notification
  useEffect(() => {
    const handleQuitState = async () => {
      const messaging = getMessaging();
      const initialFcm = await getInitialNotification(messaging);

      if (initialFcm) {
        if (isAuthenticated) {
          await persistNotification(initialFcm);
          qc.invalidateQueries({ queryKey: NOTIF_KEY });
        }
        // Use polling — navigator is not ready at this point
        navigateWhenReady(initialFcm.data as Record<string, string>);
      }

      // Notifee quit-state press
      const initialNotifee = await notifee.getInitialNotification();
      if (initialNotifee?.notification?.data) {
        navigateWhenReady(
          initialNotifee.notification.data as Record<string, string>,
        );
      }
    };

    handleQuitState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
