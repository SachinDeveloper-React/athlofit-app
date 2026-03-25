// ─── hydrationNotification.service.ts ────────────────────────────────────────
// Schedules / cancels repeating daily hydration reminders via Notifee.
// Each alarm fires every day at the chosen time using a TIMESTAMP trigger
// that auto-reschedules via repeatFrequency.

import notifee, {
  AndroidImportance,
  AndroidVisibility,
  RepeatFrequency,
  TimestampTrigger,
  TriggerType,
  AuthorizationStatus,
} from '@notifee/react-native';

export const HYDRATION_CHANNEL_ID = 'hydration_reminders';
const NOTIFICATION_ID_PREFIX = 'hydration_alarm_';

// ─── Channel setup (call once on app boot) ────────────────────────────────────
export const setupHydrationChannel = async (): Promise<void> => {
  await notifee.createChannel({
    id: HYDRATION_CHANNEL_ID,
    name: 'Hydration Reminders',
    description: 'Daily water drinking reminders',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'default',
    vibration: true,
    vibrationPattern: [300, 500],
    lights: true,
    lightColor: '#38bdf8',
  });
};

// ─── Permission request ───────────────────────────────────────────────────────
export const requestNotificationPermission = async (): Promise<boolean> => {
  const settings = await notifee.requestPermission();
  return (
    settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds a notification ID from a time string like "08:00" */
export const buildNotifId = (timeStr: string): string =>
  `${NOTIFICATION_ID_PREFIX}${timeStr.replace(':', '_')}`;

/**
 * Returns the next Date for a given "HH:MM" time string.
 * If that time has already passed today, schedules for tomorrow.
 */
const nextOccurrence = (timeStr: string): Date => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const now = new Date();
  const next = new Date();
  next.setHours(hours, minutes, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next;
};

// ─── Schedule a single alarm ──────────────────────────────────────────────────
export const scheduleHydrationAlarm = async (
  timeStr: string,
): Promise<void> => {
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: nextOccurrence(timeStr).getTime(),
    repeatFrequency: RepeatFrequency.DAILY,
    alarmManager: {
      allowWhileIdle: true, // fires even in Doze mode
    },
  };

  await notifee.createTriggerNotification(
    {
      id: buildNotifId(timeStr),
      title: '💧 Time to Hydrate!',
      body: 'Keep up your water intake. Small sips, big wins!',
      android: {
        channelId: HYDRATION_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
        smallIcon: 'ic_notification', // must exist in android/app/src/main/res
        color: '#38bdf8',
        showTimestamp: true,
        vibrationPattern: [300, 500],
      },
      ios: {
        sound: 'default',
        foregroundPresentationOptions: {
          alert: true,
          badge: true,
          sound: true,
        },
      },
    },
    trigger,
  );
};

// ─── Cancel a single alarm ────────────────────────────────────────────────────
export const cancelHydrationAlarm = async (timeStr: string): Promise<void> => {
  await notifee.cancelTriggerNotification(buildNotifId(timeStr));
};

// ─── Cancel ALL hydration alarms ─────────────────────────────────────────────
export const cancelAllHydrationAlarms = async (): Promise<void> => {
  const triggers = await notifee.getTriggerNotifications();
  const ids = triggers
    .filter(t => t.notification.id?.startsWith(NOTIFICATION_ID_PREFIX))
    .map(t => t.notification.id!);
  await Promise.all(ids.map(id => notifee.cancelTriggerNotification(id)));
};

// ─── Get currently scheduled alarm time strings ───────────────────────────────
export const getScheduledAlarmTimes = async (): Promise<string[]> => {
  const triggers = await notifee.getTriggerNotifications();
  return triggers
    .filter(t => t.notification.id?.startsWith(NOTIFICATION_ID_PREFIX))
    .map(t => {
      const raw = t.notification.id!.replace(NOTIFICATION_ID_PREFIX, '');
      return raw.replace('_', ':'); // "08_00" → "08:00"
    });
};
