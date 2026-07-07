// ─── permissionStatus.service.ts ─────────────────────────────────────────────
// Checks status of all app permissions and provides functions to request them.

import { Platform, PermissionsAndroid, Linking, Alert } from 'react-native';
import notifee, { AuthorizationStatus } from '@notifee/react-native';

export type PermissionState = 'granted' | 'denied' | 'not_requested';

export interface PermissionStatuses {
  notification: PermissionState;
  activityRecognition: PermissionState;
  camera: PermissionState;
}

/**
 * Check the status of all app permissions.
 */
export async function getAllPermissionStatuses(): Promise<PermissionStatuses> {
  const statuses: PermissionStatuses = {
    notification: 'not_requested',
    activityRecognition: 'not_requested',
    camera: 'not_requested',
  };

  // ── Notification ──
  try {
    const settings = await notifee.getNotificationSettings();
    if (settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED) {
      statuses.notification = 'granted';
    } else if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
      statuses.notification = 'denied';
    }
  } catch {
    // silent
  }

  // ── Activity Recognition (Android only) ──
  if (Platform.OS === 'android') {
    if (Platform.Version < 29) {
      statuses.activityRecognition = 'granted'; // not required below API 29
    } else {
      try {
        const result = await PermissionsAndroid.check(
          'android.permission.ACTIVITY_RECOGNITION' as any,
        );
        statuses.activityRecognition = result ? 'granted' : 'denied';
      } catch {
        statuses.activityRecognition = 'denied';
      }
    }
  } else {
    // iOS doesn't need this — HealthKit/CoreMotion handles it
    statuses.activityRecognition = 'granted';
  }

  // ── Camera ──
  if (Platform.OS === 'android') {
    try {
      const result = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.CAMERA,
      );
      statuses.camera = result ? 'granted' : 'denied';
    } catch {
      statuses.camera = 'not_requested';
    }
  } else {
    // iOS camera permission is checked at use-time
    statuses.camera = 'not_requested';
  }

  return statuses;
}

/**
 * Request a specific permission. If permanently denied, shows alert to open Settings.
 */
export async function requestPermissionByKey(
  key: keyof PermissionStatuses,
): Promise<boolean> {
  if (key === 'notification') {
    const settings = await notifee.requestPermission();
    if (settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED) {
      return true;
    }
    // Permanently denied — open settings
    showOpenSettingsAlert('Notifications');
    return false;
  }

  if (key === 'activityRecognition' && Platform.OS === 'android') {
    if (Platform.Version < 29) return true;
    const result = await PermissionsAndroid.request(
      'android.permission.ACTIVITY_RECOGNITION' as any,
      {
        title: 'Step Counter Permission',
        message: 'Athlofit needs access to your physical activity to count steps.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    if (result === PermissionsAndroid.RESULTS.GRANTED) return true;
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      showOpenSettingsAlert('Activity Recognition');
    }
    return false;
  }

  if (key === 'camera') {
    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'Athlofit needs camera access for heart rate measurement and photos.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      if (result === PermissionsAndroid.RESULTS.GRANTED) return true;
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        showOpenSettingsAlert('Camera');
      }
      return false;
    } else {
      // iOS — open settings since camera permission is handled at use-time
      showOpenSettingsAlert('Camera');
      return false;
    }
  }

  return false;
}

function showOpenSettingsAlert(permissionName: string) {
  Alert.alert(
    `${permissionName} Permission Required`,
    `Please open Settings and grant ${permissionName} access to Athlofit.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          if (Platform.OS === 'ios') {
            Linking.openURL('app-settings:');
          } else {
            Linking.openSettings();
          }
        },
      },
    ],
  );
}
