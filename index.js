/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './src/app/App';
import { name as appName } from './app.json';
import messaging, {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import {
  createPushChannel,
  displayPushNotification,
  handleNotificationNavigation,
  PUSH_CHANNEL_ID,
} from './src/services/pushNotificationService';

// ─── FCM background message handler ──────────────────────────────────────────
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  console.log('[FCM] Background message:', remoteMessage);

  // For data-only messages, display manually via Notifee
  if (!remoteMessage.notification && remoteMessage.data) {
    await createPushChannel();
    await displayPushNotification({
      ...remoteMessage,
      notification: {
        title: remoteMessage.data.title,
        body: remoteMessage.data.body,
      },
    });
  }
  // Note: DB persistence for background messages happens when the user
  // opens the app — useNotificationSetup handles getInitialNotification.
});

// ─── Notifee background event handler ────────────────────────────────────────
// Handles notification press when app is in background.

notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS) {
    const data = detail.notification?.data;
    handleNotificationNavigation(data);
  }
});

AppRegistry.registerComponent(appName, () => App);
