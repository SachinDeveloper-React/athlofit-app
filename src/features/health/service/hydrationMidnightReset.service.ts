// ─── hydrationMidnightReset.service.ts ───────────────────────────────────────
// Schedules a silent daily midnight trigger that resets the hydration store.
// Works in two layers:
//   1. Notifee silent notification at 00:00 → triggers reset even in background
//   2. AppState listener → resets if the user opens the app on a new day

import notifee, {
  EventType,
  RepeatFrequency,
  TimestampTrigger,
  TriggerType,
  AndroidImportance,
} from '@notifee/react-native';
import { AppState, AppStateStatus } from 'react-native';
import { useHydrationStore } from '../store/hydrationStore';
import { deleteRecordsByTimeRange } from 'react-native-health-connect';
import { buildPreviousDaysFilter } from '../utils/healthFormatters';

const MIDNIGHT_NOTIF_ID = 'hydration_midnight_reset';
const MIDNIGHT_CHANNEL_ID = 'hydration_silent';
const LAST_RESET_KEY = 'hydration_last_reset_date';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "2024-03-25" string for today */
const todayStr = (): string => new Date().toDateString();

/** Next midnight Date */
const nextMidnight = (): Date => {
  const d = new Date();
  d.setHours(24, 0, 0, 0); // tomorrow at 00:00:00.000
  return d;
};

// ─── Silent channel (no sound/vibration, no heads-up) ────────────────────────
export const setupMidnightChannel = async (): Promise<void> => {
  await notifee.createChannel({
    id: MIDNIGHT_CHANNEL_ID,
    name: 'Hydration Auto Reset',
    importance: AndroidImportance.MIN, // silent, no banner
    vibration: false,
    sound: undefined,
  });
};

// ─── Core reset logic ─────────────────────────────────────────────────────────
export const performMidnightReset = (): void => {
  const store = useHydrationStore.getState();
  store.resetDay();
  deleteRecordsByTimeRange('Hydration', buildPreviousDaysFilter()).catch(e =>
    console.warn('[HC] Previous days hydration delete failed:', e),
  );
  console.log(
    '[Hydration] Midnight reset performed at',
    new Date().toISOString(),
  );
};

// ─── Schedule the repeating midnight trigger ──────────────────────────────────
export const scheduleMidnightReset = async (): Promise<void> => {
  // Cancel any existing one first to avoid duplicates
  await notifee.cancelTriggerNotification(MIDNIGHT_NOTIF_ID).catch(() => {});

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: nextMidnight().getTime(),
    repeatFrequency: RepeatFrequency.DAILY,
    alarmManager: {
      allowWhileIdle: true,
    },
  };

  await notifee.createTriggerNotification(
    {
      id: MIDNIGHT_NOTIF_ID,
      title: 'New Day — Hydration Reset',
      body: 'Your water tracker has been reset for today 💧',
      android: {
        channelId: MIDNIGHT_CHANNEL_ID,
        importance: AndroidImportance.MIN,
        asForegroundService: false,
        smallIcon: 'ic_notification',
        // No heads-up — purely a background trigger
        pressAction: { id: 'default' },
      },
      ios: {
        // Silent push on iOS — no alert shown
        foregroundPresentationOptions: {
          alert: false,
          badge: false,
          sound: false,
        },
      },
    },
    trigger,
  );

  console.log(
    '[Hydration] Midnight reset scheduled for',
    nextMidnight().toISOString(),
  );
};

// ─── Notifee foreground event handler ────────────────────────────────────────
// Call this once in App.tsx inside notifee.onForegroundEvent(...)
export const handleMidnightForegroundEvent = ({
  type,
  detail,
}: {
  type: EventType;
  detail: { notification?: { id?: string } };
}): void => {
  if (
    type === EventType.DELIVERED &&
    detail.notification?.id === MIDNIGHT_NOTIF_ID
  ) {
    performMidnightReset();
  }
};

// ─── Background event handler ─────────────────────────────────────────────────
// Register this with notifee.onBackgroundEvent(...) in index.js
export const handleMidnightBackgroundEvent = async ({
  type,
  detail,
}: {
  type: EventType;
  detail: { notification?: { id?: string } };
}): Promise<void> => {
  if (
    type === EventType.DELIVERED &&
    detail.notification?.id === MIDNIGHT_NOTIF_ID
  ) {
    performMidnightReset();
  }
};

// ─── AppState guard — resets if app opens on a new day ───────────────────────
// Covers the case where the phone was off / app killed at midnight.
let lastKnownDate = todayStr();

export const initAppStateReset = (): (() => void) => {
  const handleAppStateChange = (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      const currentDate = todayStr();
      if (currentDate !== lastKnownDate) {
        lastKnownDate = currentDate;
        performMidnightReset();
      }
    }
  };

  const subscription = AppState.addEventListener(
    'change',
    handleAppStateChange,
  );
  return () => subscription.remove();
};
