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
import BackgroundFetch from 'react-native-background-fetch';
import { headlessTask } from './src/features/health/service/backgroundSync.service';
import { initCrashReporting, recordError } from './src/services/crashReporting';

// ─── Crash reporting ─────────────────────────────────────────────────────────
// Initialised here rather than inside App, so build/device attributes are
// attached before any of the module-level work below runs. A crash during
// startup is the one most worth capturing and the one an in-component effect
// would miss entirely.
initCrashReporting();

// ─── FCM background message handler ──────────────────────────────────────────
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  console.log('[FCM] Background message:', remoteMessage);

  // Control message: an admin toggled step tracking for this account. Handled
  // here as well as in the foreground handler because the case that matters
  // most — a device happily counting steps with the app closed — is precisely
  // the one where only the background handler runs.
  try {
    const { handleStepTrackingPush } = require('./src/services/stepTrackingGate');
    handleStepTrackingPush(remoteMessage.data);
  } catch (e) {
    console.warn('[FCM] step tracking push handling failed:', e?.message);
  }

  // For data-only messages, display manually via Notifee.
  //
  // Guarded because this runs in a headless JS context with the app killed:
  // there is no error boundary and no UI above it, so anything that throws
  // here surfaces as a bare JavascriptException and takes the process down.
  try {
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
  } catch (e) {
    recordError(e, 'fcmBackgroundMessage');
  }
  // Note: DB persistence for background messages happens when the user
  // opens the app — useNotificationSetup handles getInitialNotification.
});

// ─── Notifee background event handler ────────────────────────────────────────
// Handles notification press when app is in background/killed.

notifee.onBackgroundEvent(async ({ type, detail }) => {
  // Same reasoning as the FCM handler above: a throw in this context is a
  // fatal JS-thread exception, not a missed navigation.
  try {
    if (type === EventType.PRESS) {
      const data = detail.notification?.data;
      handleNotificationNavigation(data);
    }
  } catch (e) {
    recordError(e, 'notifeeBackgroundEvent');
  }
});

AppRegistry.registerComponent(appName, () => App);

// ─── react-native-background-fetch headless task ──────────────────────────────
// This runs on Android when the app is fully terminated (killed from recents).
// Must be registered AFTER AppRegistry.registerComponent().
BackgroundFetch.registerHeadlessTask(headlessTask);
