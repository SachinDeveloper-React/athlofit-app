// ─── healthInitStore.ts ────────────────────────────────────────────────────────
// Holds the result of health SDK initialization (performed during splash/bootstrap).
// This allows TrackerScreen to skip the setup phase and render immediately.

import { create } from 'zustand';
import { Platform } from 'react-native';
import type { HealthPlatform } from '../hooks/useHealth';

import { initializeHealthKit } from '../service/healthkit.service';

// Health Connect is Android-only — lazy-import to avoid crashing on iOS
// where the native module doesn't exist.
const getHealthConnectService = () =>
  require('../service/healthConnect.service') as {
    isHealthConnectAvailable: () => Promise<boolean>;
    initializeHealthConnect: () => Promise<boolean>;
    hasHealthConnectPermissions: () => Promise<boolean>;
  };

interface HealthInitState {
  /** Whether pre-initialization has been performed this session */
  isInitialized: boolean;
  /** The detected platform after init */
  platform: HealthPlatform;
  /** Whether permissions are granted and SDK is ready */
  isReady: boolean;
  /** Error message if init failed */
  error: string | null;
}

interface HealthInitStore extends HealthInitState {
  /** Run during app bootstrap (splash screen) to pre-initialize health SDK */
  initialize: () => Promise<void>;
  /** Reset (e.g. on logout) */
  reset: () => void;
}

export const useHealthInitStore = create<HealthInitStore>((set, get) => ({
  isInitialized: false,
  platform: 'unavailable',
  isReady: false,
  error: null,

  initialize: async () => {
    // Don't re-run if already initialized this session
    if (get().isInitialized) return;

    try {
      if (Platform.OS === 'ios') {
        const ok = await initializeHealthKit();
        set({
          isInitialized: true,
          platform: ok ? 'healthkit' : 'unavailable',
          isReady: ok,
          error: ok ? null : 'HealthKit permission denied',
        });
      } else if (Platform.OS === 'android') {
        const { isHealthConnectAvailable, initializeHealthConnect, hasHealthConnectPermissions } = getHealthConnectService();
        const available = await isHealthConnectAvailable();
        if (!available) {
          // Health Connect not installed — check native step service as fallback
          const { stepService } = await import('../../../services/stepService');
          const source = await stepService.initialize();
          if (source === 'native_sensor') {
            set({
              isInitialized: true,
              platform: 'healthconnect',
              isReady: true,
              error: null,
            });
          } else {
            set({
              isInitialized: true,
              platform: 'unavailable',
              isReady: false,
              error: 'Health Connect not installed. Please install it from the Play Store.',
            });
          }
          return;
        }

        // Health Connect is available — check if permissions already granted
        const alreadyGranted = await hasHealthConnectPermissions();
        if (alreadyGranted) {
          set({
            isInitialized: true,
            platform: 'healthconnect',
            isReady: true,
            error: null,
          });
          return;
        }

        // Permissions not granted — try requesting
        // Signal to native WidgetUpdateWorker
        const { widgetService } = await import('../../../services/widgetService');
        await widgetService.setAppInitialising(true);

        let ok = false;
        try {
          ok = await initializeHealthConnect();
        } finally {
          await widgetService.setAppInitialising(false);
        }

        if (ok) {
          set({
            isInitialized: true,
            platform: 'healthconnect',
            isReady: true,
            error: null,
          });
        } else {
          // Permissions denied — check native sensor fallback
          const { stepService } = await import('../../../services/stepService');
          const source = await stepService.initialize();
          if (source === 'native_sensor') {
            set({
              isInitialized: true,
              platform: 'healthconnect',
              isReady: true,
              error: null,
            });
          } else {
            set({
              isInitialized: true,
              platform: 'unavailable',
              isReady: false,
              error: 'Health Connect permission denied',
            });
          }
        }
      }
    } catch (e: any) {
      set({
        isInitialized: true,
        platform: 'unavailable',
        isReady: false,
        error: e?.message ?? 'Unknown error during health initialization',
      });
    }
  },

  reset: () => set({
    isInitialized: false,
    platform: 'unavailable',
    isReady: false,
    error: null,
  }),
}));
