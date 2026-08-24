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
import { handleStepTrackingPush } from '../services/stepTrackingGate';
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

// ─── Module-level flag — BUG-052 ─────────────────────────────────────────────
// Ensures getInitialNotification runs only once per cold start, not on every
// component mount (AppShell re-mounts on auth state changes).
let initialNotificationHandled = false;

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

  // ── 4. Foreground FCM → display via Notifee ──────────────────────────────
  // (Notifee press is handled in step 5)
  // NOTE: Backend already persists notifications before sending FCM push,
  // so we don't need to persist again here (was causing duplicates).
  useEffect(() => {
    const messaging = getMessaging();
    const unsub = onMessage(messaging, async remoteMessage => {
      // Control message: an admin toggled step tracking for this account.
      // Applied before display so the native service stops immediately rather
      // than after the notification finishes rendering.
      handleStepTrackingPush(remoteMessage.data as Record<string, string>);
      await displayPushNotification(remoteMessage);
      if (isAuthenticated) {
        // Just invalidate to refresh the notification list
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
  // NOTE: Backend already persists notifications before sending FCM push,
  // so we don't need to persist again here (was causing duplicates).
  useEffect(() => {
    const messaging = getMessaging();
    const unsub = onNotificationOpenedApp(messaging, async remoteMessage => {
      if (isAuthenticated) {
        // Just invalidate to refresh the notification list
        qc.invalidateQueries({ queryKey: NOTIF_KEY });
      }
      navigateWhenReady(remoteMessage.data as Record<string, string>);
    });
    return unsub;
  }, [isAuthenticated, qc]);

  // ── 7. Quit-state: app opened by tapping notification ────────────────────
  // BUG-052: getInitialNotification must run only ONCE per app cold-start.
  // useNotificationSetup is called from AppShell which re-mounts on auth
  // state changes (logout → login), so a component-level ref would re-run
  // on every re-mount. A module-level flag persists for the full app lifecycle.
  useEffect(() => {
    if (initialNotificationHandled) return;
    initialNotificationHandled = true;

    const handleQuitState = async () => {
      const messaging = getMessaging();
      const initialFcm = await getInitialNotification(messaging);

      if (initialFcm) {
        if (isAuthenticated) {
          qc.invalidateQueries({ queryKey: NOTIF_KEY });
        }
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
